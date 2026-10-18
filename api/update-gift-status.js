const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;
    const new_status = body.new_status;

    if (!telegram_id || !new_status) {
      return res.status(400).json({ error: 'telegram_id и new_status обязательны' });
    }

    const telegramIdNum = Number(telegram_id);
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const validStatuses = ['not_seen', 'chosen', 'bought', 'shipping', 'ready', 'received'];
    if (validStatuses.indexOf(new_status) === -1) {
      return res.status(400).json({ error: 'Неизвестный статус' });
    }

    const sql = neon(process.env.DATABASE_URL);

    const me = await sql`
      SELECT * FROM santas WHERE telegram_id = ${telegramIdNum}
    `;

    if (me.length === 0) {
      return res.status(404).json({ error: 'Ты не зарегистрирован' });
    }

    const myData = me[0];

    // Если это получатель отмечает "получено" — ищем, кто дарил ему
    if (new_status === 'received') {
      // Ищем Санту, который дарит мне (тот, у кого assigned_to = мой ID)
      const santa = await sql`
        SELECT * FROM santas WHERE assigned_to = ${telegramIdNum}
      `;

      if (santa.length === 0) {
        return res.status(400).json({ error: 'Тебе ещё не назначен Санта' });
      }

      const santaData = santa[0];

      if (santaData.gift_status !== 'ready') {
        return res.status(400).json({ error: 'Подарок ещё не готов к выдаче' });
      }

      // Меняем статус у Санты
      await sql`
        UPDATE santas SET gift_status = 'received' WHERE telegram_id = ${santaData.telegram_id}
      `;

      return res.status(200).json({ success: true });
    }

    // Если это Санта меняет свой статус — проверяем, что он не пытается сбросить "received"
    if (myData.gift_status === 'received') {
      return res.status(400).json({ error: 'Подарок уже получен — статус менять нельзя' });
    }

    await sql`
      UPDATE santas SET gift_status = ${new_status} WHERE telegram_id = ${telegramIdNum}
    `;

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Ошибка update-gift-status:', err);
    return res.status(500).json({ error: err.message });
  }
};
