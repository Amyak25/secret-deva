const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id обязателен' });
    }

    const telegramIdNum = Number(telegram_id);
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Свой профиль
    const me = await sql`
      SELECT * FROM santas WHERE telegram_id = ${telegramIdNum}
    `;

    if (me.length === 0) {
      return res.status(404).json({ error: 'Ты ещё не зарегистрирован' });
    }

    const myData = me[0];

    // Если ещё не распределено
    if (!myData.assigned_to) {
      return res.status(200).json({
        me: myData,
        assigned: null,
        assignment_done: false
      });
    }

    // Данные подопечного (без его assigned_to!)
    const assignedData = await sql`
      SELECT telegram_id, nickname, first_name, last_name,
             ozon_address, wb_address, cdek_address, wishes
      FROM santas WHERE telegram_id = ${myData.assigned_to}
    `;

    return res.status(200).json({
      me: myData,
      assigned: assignedData[0] || null,
      assignment_done: true
    });

  } catch (err) {
    console.error('Ошибка get-santa:', err);
    return res.status(500).json({ error: err.message });
  }
};
