const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const body = req.body || {};
    const admin_id = body.admin_id;

    if (!admin_id) {
      return res.status(400).json({
        error: 'admin_id обязателен'
      });
    }

    const adminIdNum = Number(admin_id);

    if (!Number.isSafeInteger(adminIdNum) || adminIdNum <= 0) {
      return res.status(400).json({
        error: 'Некорректный admin_id'
      });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'Ошибка подключения к базе данных'
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем права администратора
    const requester = await sql`
      SELECT is_admin
      FROM santas
      WHERE telegram_id = ${adminIdNum}
      LIMIT 1
    `;

    if (requester.length === 0 || !requester[0].is_admin) {
      return res.status(403).json({
        error: 'Нет прав'
      });
    }

    // Получаем всех участников, кроме наблюдателей
    const all = await sql`
      SELECT telegram_id, nickname
      FROM santas
      WHERE is_observer = FALSE
      ORDER BY created_at ASC
    `;

    if (all.length < 2) {
      return res.status(400).json({
        error: 'Нужно минимум 2 участника (не считая наблюдателя)'
      });
    }

    // Проверяем, существует ли уже распределение.
    // Если существует — ничего не меняем.
    const alreadyAssigned = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM santas
      WHERE assigned_to IS NOT NULL
        AND is_observer = FALSE
    `;

    if (alreadyAssigned[0].cnt > 0) {
      return res.status(400).json({
        error: 'Распределение уже существует. Существующие назначения сохранены.'
      });
    }

    // Собираем ID участников
    const ids = all.map(function (participant) {
      return String(participant.telegram_id);
    });

    // Перемешиваем участников
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      const temp = ids[i];
      ids[i] = ids[j];
      ids[j] = temp;
    }

    // Создаём циклическое распределение без назначения самому себе
    const assignments = [];

    for (let i = 0; i < all.length; i++) {
      assignments.push({
        santaId: String(all[i].telegram_id),
        recipientId: ids[(i + 1) % ids.length]
      });
    }

    // Записываем назначения
    for (const assignment of assignments) {
      await sql`
        UPDATE santas
        SET assigned_to = ${assignment.recipientId}
        WHERE telegram_id = ${assignment.santaId}
      `;
    }

    return res.status(200).json({
      success: true,
      total: all.length
    });

  } catch (err) {
    console.error('Ошибка distribute:', err);

    return res.status(500).json({
      error: 'Внутренняя ошибка сервера'
    });
  }
};
