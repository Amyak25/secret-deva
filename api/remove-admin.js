const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const admin_id = body.admin_id;
    const target_id = body.target_id;

    if (!admin_id || !target_id) {
      return res.status(400).json({ error: 'admin_id и target_id обязательны' });
    }

    const adminIdNum = Number(admin_id);
    const targetIdNum = Number(target_id);

    if (isNaN(adminIdNum) || isNaN(targetIdNum)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, что запрашивающий — админ
    const requester = await sql`
      SELECT is_admin FROM santas WHERE telegram_id = ${adminIdNum}
    `;
    if (requester.length === 0 || !requester[0].is_admin) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    // Проверяем, что удаляемый — админ
    const target = await sql`
      SELECT is_admin, is_observer FROM santas WHERE telegram_id = ${targetIdNum}
    `;
    if (target.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }
    if (!target[0].is_admin) {
      return res.status(400).json({ error: 'Он не админ' });
    }
    if (target[0].is_observer) {
      return res.status(400).json({ error: 'Нельзя снять админку с наблюдателя' });
    }
    if (targetIdNum === adminIdNum) {
      return res.status(400).json({ error: 'Нельзя снять админку с себя' });
    }

    // Снимаем админку
    await sql`
      UPDATE santas SET is_admin = FALSE WHERE telegram_id = ${targetIdNum}
    `;

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Ошибка remove-admin:', err);
    return res.status(500).json({ error: err.message });
  }
};
