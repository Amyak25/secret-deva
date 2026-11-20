const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const body = req.body || {};

    const telegramId = String(body.telegram_id || '').trim();
    const newStatus = body.new_status;

    // Проверяем Telegram ID
    if (!telegramId) {
      return res.status(400).json({
        error: 'telegram_id обязателен'
      });
    }

    if (!/^\d+$/.test(telegramId)) {
      return res.status(400).json({
        error: 'Некорректный telegram_id'
      });
    }

    // Разрешённые статусы
    const validStatuses = [
      'not_seen',
      'chosen',
      'bought',
      'shipping',
      'ready',
      'received'
    ];

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        error: 'Неизвестный статус'
      });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'Ошибка подключения к базе данных'
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Находим пользователя, который нажал кнопку
    const me = await sql`
      SELECT
        telegram_id::text AS telegram_id,
        assigned_to::text AS assigned_to
      FROM santas
      WHERE telegram_id::text = ${telegramId}
      LIMIT 1
    `;

    if (me.length === 0) {
      return res.status(404).json({
        error: 'Ты не зарегистрирован'
      });
    }

    const myData = me[0];

    // Если пользователь подтверждает получение подарка
    if (newStatus === 'received') {

      // Проверяем, что этому человеку действительно назначен Санта
      const santa = await sql`
        SELECT telegram_id
        FROM santas
        WHERE assigned_to::text = ${telegramId}
        LIMIT 1
      `;

      if (santa.length === 0) {
        return res.status(400).json({
          error: 'Тебе ещё не назначен Санта'
        });
      }

      // Обновляем статус подарка самого пользователя
      const updated = await sql`
        UPDATE santas
        SET gift_status = 'received'
        WHERE telegram_id::text = ${telegramId}
        RETURNING telegram_id
      `;

      if (updated.length === 0) {
        return res.status(404).json({
          error: 'Не удалось обновить статус'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Подарок отмечен как полученный'
      });
    }

    // Для остальных статусов проверяем назначенного подопечного
    const targetId = String(myData.assigned_to || '').trim();

    if (!targetId) {
      return res.status(400).json({
        error: 'Тебе ещё не назначен подопечный'
      });
    }

    // Обновляем статус именно подопечного,
    // которого сервер нашёл по assigned_to.
    // target_id от браузера больше не используется.
    const updated = await sql`
      UPDATE santas
      SET gift_status = ${newStatus}
      WHERE telegram_id::text = ${targetId}
      RETURNING telegram_id
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        error: 'Подопечный не найден в базе данных'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Статус успешно обновлён'
    });

  } catch (err) {
    console.error('Ошибка update-gift-status:', err);

    return res.status(500).json({
      error: 'Внутренняя ошибка сервера'
    });
  }
};
