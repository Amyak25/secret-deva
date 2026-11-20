
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;

    // Проверяем Telegram ID
    if (!telegram_id) {
      return res.status(400).json({
        error: 'telegram_id обязателен'
      });
    }

    const telegramIdNum = Number(telegram_id);

    if (!Number.isSafeInteger(telegramIdNum) || telegramIdNum <= 0) {
      return res.status(400).json({
        error: 'Некорректный telegram_id'
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Получаем данные текущего пользователя
    const me = await sql`
      SELECT *
      FROM santas
      WHERE telegram_id = ${telegramIdNum}
      LIMIT 1
    `;

    // Проверяем регистрацию
    if (me.length === 0) {
      return res.status(404).json({
        error: 'Ты ещё не зарегистрирован'
      });
    }

    const myData = me[0];

    // Если распределение ещё не проводилось
    if (!myData.assigned_to) {
      return res.status(200).json({
        me: myData,
        assigned: null,
        assignment_done: false
      });
    }

    // Получаем данные подопечного,
    // включая его актуальный статус подарка
    const assignedData = await sql`
      SELECT
        telegram_id,
        nickname,
        first_name,
        last_name,
        ozon_address,
        wb_address,
        cdek_address,
        wishes,
        gift_status
      FROM santas
      WHERE telegram_id = ${myData.assigned_to}
      LIMIT 1
    `;

    // Проверяем, что подопечный существует
    if (assignedData.length === 0) {
      return res.status(200).json({
        me: myData,
        assigned: null,
        assignment_done: false,
        error: 'Назначенный подопечный не найден'
      });
    }

    // Возвращаем данные обоих участников
    return res.status(200).json({
      me: myData,
      assigned: assignedData[0],
      assignment_done: true
    });

  } catch (err) {
    console.error('Ошибка get-santa:', err);

    return res.status(500).json({
      error: 'Ошибка сервера при загрузке данных'
    });
  }
};
