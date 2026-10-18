const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;
    const wishes = body.wishes || '';

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id обязателен' });
    }

    const telegramIdNum = Number(telegram_id);
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      UPDATE santas SET wishes = ${wishes} WHERE telegram_id = ${telegramIdNum}
    `;

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Ошибка update-wishes:', err);
    return res.status(500).json({ error: err.message });
  }
};
