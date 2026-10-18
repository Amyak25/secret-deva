const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const admin_id = body.admin_id;

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id обязателен' });
    }

    const adminIdNum = Number(admin_id);
    if (isNaN(adminIdNum)) {
      return res.status(400).json({ error: 'Некорректный admin_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, что это админ
    const requester = await sql`
      SELECT is_admin FROM santas WHERE telegram_id = ${adminIdNum}
    `;
    if (requester.length === 0 || !requester[0].is_admin) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    // Получаем всех участников
    const all = await sql`
      SELECT telegram_id, nickname FROM santas ORDER BY created_at ASC
    `;

    if (all.length < 2) {
      return res.status(400).json({ error: 'Нужно минимум 2 участника' });
    }

    // Проверяем, не распределено ли уже
    const alreadyAssigned = await sql`
      SELECT COUNT(*)::int AS cnt FROM santas WHERE assigned_to IS NOT NULL
    `;
    if (alreadyAssigned[0].cnt > 0) {
      return res.status(400).json({ error: 'Уже распределено. Сначала сбросьте.' });
    }

    // Алгоритм: перемешиваем, назначаем по кругу
    const ids = all.map(function(s) { return s.telegram_id; });

    // Перемешиваем (Fisher-Yates)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }

    // Проверяем, что никто не получил себя (при перемешивании может быть)
    // Если получилось — сдвигаем на 1
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === all[i].telegram_id) {
        // Меняем местами с соседом
        const nextIdx = (i + 1) % ids.length;
        const tmp = ids[i];
        ids[i] = ids[nextIdx];
        ids[nextIdx] = tmp;
      }
    }

    // Записываем в БД: участник all[i] → дарит ids[i]
    for (let i = 0; i < all.length; i++) {
      await sql`
        UPDATE santas SET assigned_to = ${ids[i]} WHERE telegram_id = ${all[i].telegram_id}
      `;
    }

    return res.status(200).json({
      success: true,
      total: all.length
    });

  } catch (err) {
    console.error('Ошибка distribute:', err);
    return res.status(500).json({ error: err.message });
  }
};
