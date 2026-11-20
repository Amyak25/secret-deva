
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const body = req.body || {};

    // Кто нажимает кнопку
    const telegram_id = body.telegram_id;

    // Кому дарит подарок (подопечный)
    const target_id = body.target_id;

    // Новый статус
    const new_status = body.new_status;

    // Проверяем обязательные данные
    if (!telegram_id || !new_status) {
      return res.status(400).json({
        error: 'telegram_id и new_status обязательны'
      });
    }

    const telegramIdNum = Number(telegram_id);

    if (
      !Number.isSafeInteger(telegramIdNum) ||
      telegramIdNum <= 0
    ) {
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

    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({
        error: 'Неизвестный статус'
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // 1. Находим пользователя, который нажал кнопку
    const me = await sql`
      SELECT *
      FROM santas
      WHERE telegram_id = ${telegramIdNum}
      LIMIT 1
    `;

    if (me.length === 0) {
      return res.status(404).json({
        error: 'Ты не зарегистрирован'
      });
    }

    const myData = me[0];

    // ==========================================
    // 2. ЕСЛИ ПОЛУЧАТЕЛЬ НАЖИМАЕТ "ПОДАРОК ПОЛУЧЕН"
    // ==========================================

    if (new_status === 'received') {

      // Проверяем, назначен ли этому участнику Санта
      const santa = await sql`
        SELECT telegram_id
        FROM santas
        WHERE assigned_to = ${telegramIdNum}
        LIMIT 1
      `;

      if (santa.length === 0) {
        return res.status(400).json({
          error: 'Тебе ещё не назначен Санта'
        });
      }

      // ВАЖНО:
      // Обновляем статус самого получателя,
      // а не его Санты.
      const updated = await sql`
        UPDATE santas
        SET gift_status = 'received'
        WHERE telegram_id = ${telegramIdNum}
        RETURNING telegram_id, gift_status
      `;

      if (updated.length === 0) {
        return res.status(404).json({
          error: 'Не удалось обновить статус'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Подарок получен',
        updated: updated[0]
      });
    }

    // ==========================================
    // 3. ЕСЛИ САНТА МЕНЯЕТ СТАТУС ПОДОПЕЧНОМУ
    // ==========================================

    if (!target_id) {
      return res.status(400).json({
        error: 'Не указан ID подопечного'
      });
    }

    const targetIdNum = Number(target_id);

    if (
      !Number.isSafeInteger(targetIdNum) ||
      targetIdNum <= 0
    ) {
      return res.status(400).json({
        error: 'Некорректный ID подопечного'
      });
    }

    // Проверяем принадлежность подопечного.
    // Сравниваем строки, чтобы избежать ошибки
    // из-за разных типов данных (строка и число).
    if (
      myData.assigned_to == null ||
      String(myData.assigned_to) !== String(targetIdNum)
    ) {
      return res.status(403).json({
        error: 'Это не твой подопечный!'
      });
    }

    // Проверяем, что подопечный существует
    const target = await sql`
      SELECT telegram_id
      FROM santas
      WHERE telegram_id = ${targetIdNum}
      LIMIT 1
    `;

    if (target.length === 0) {
      return res.status(404).json({
        error: 'Подопечный не найден'
      });
    }

    // Обновляем статус ИМЕННО ПОДОПЕЧНОГО
    const updated = await sql`
      UPDATE santas
      SET gift_status = ${new_status}
      WHERE telegram_id = ${targetIdNum}
      RETURNING telegram_id, gift_status
    `;

    if (updated.length === 0) {
      return res.status(500).json({
        error: 'Не удалось сохранить статус'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Статус подопечного обновлён',
      updated: updated[0]
    });

  } catch (err) {
    console.error('Ошибка update-gift-status:', err);

    return res.status(500).json({
      error: 'Ошибка сервера при обновлении статуса'
    });
  }
};
