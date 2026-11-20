
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};

    const telegramIdNum = Number(body.telegram_id);
    const newStatus = body.new_status;

    if (!body.telegram_id || !newStatus) {
      return res.status(400).json({
        error: 'telegram_id и new_status обязательны'
      });
    }

    if (!Number.isSafeInteger(telegramIdNum) || telegramIdNum <= 0) {
      return res.status(400).json({
        error: 'Некорректный telegram_id'
      });
    }

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
      SELECT telegram_id, assigned_to
      FROM santas
      WHERE telegram_id = ${telegramIdNum}
    `;

    if (me.length === 0) {
      return res.status(404).json({
        error: 'Ты не зарегистрирован'
      });
    }

    const myData = me[0];

    // Получатель подтверждает, что подарок получен
    if (newStatus === 'received') {

      // Проверяем, что этому человеку действительно назначен Санта
      const santa = await sql`
        SELECT telegram_id
        FROM santas
        WHERE assigned_to = ${telegramIdNum}
      `;

      if (santa.length === 0) {
        return res.status(400).json({
          error: 'Тебе ещё не назначен Санта'
        });
      }

      // Статус received записываем самому получателю
      const updated = await sql`
        UPDATE santas
        SET gift_status = 'received'
        WHERE telegram_id = ${telegramIdNum}
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

    // Для остальных статусов нужен ID подопечного
    if (!body.target_id) {
      return res.status(400).json({
        error: 'Не указан подопечный'
      });
    }

    const targetIdNum = Number(body.target_id);

    if (!Number.isSafeInteger(targetIdNum) || targetIdNum <= 0) {
      return res.status(400).json({
        error: 'Некорректный target_id'
      });
    }

    // Сравниваем ID как строки, чтобы избежать ошибки
    // из-за разницы между числом и строкой
    if (String(myData.assigned_to) !== String(targetIdNum)) {
      return res.status(403).json({
        error: 'Это не твой подопечный!'
      });
    }

    // Обновляем статус подарка подопечного
    const updated = await sql`
      UPDATE santas
      SET gift_status = ${newStatus}
      WHERE telegram_id = ${targetIdNum}
      RETURNING telegram_id
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        error: 'Подопечный не найден'
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
