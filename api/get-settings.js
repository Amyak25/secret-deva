const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const settings = await sql`
      SELECT registration_end FROM settings WHERE id = 1
    `;

    if (settings.length === 0) {
      return res.status(200).json({ registration_end: null, is_open: false, seconds_left: 0 });
    }

    // PostgreSQL возвращает время без часового пояса, 
    // принудительно ставим Z (UTC), чтобы JS понял правильно
    const regEnd = new Date(settings[0].registration_end + 'Z');
    const now = new Date();
    const diffMs = regEnd.getTime() - now.getTime();
    const isOpen = diffMs > 0;

    return res.status(200).json({
      registration_end: regEnd.toISOString(),
      is_open: isOpen,
      seconds_left: isOpen ? Math.floor(diffMs / 1000) : 0
    });

  } catch (err) {
    console.error('Ошибка get-settings:', err);
    return res.status(500).json({ error: err.message });
  }
};
