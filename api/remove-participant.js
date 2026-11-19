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

    // Проверяем, что удаляемый — не админ и не наблюдатель
    const target = await sql`
      SELECT is_admin, is_observer, nickname FROM santas WHERE telegram_id = ${targetIdNum}
    `;
    if (target.length === 0) {
      return res.status(404).json({ error: 'Участник не найден' });
    }
    if (target[0].is_admin || target[0].is_observer) {
      return res.status(400).json({ error: 'Нельзя удалить админа или наблюдателя' });
    }

    // 1. Если этот участник кому-то назначен как Санта — сбрасываем это назначение
    await sql`
      UPDATE santas SET assigned_to = NULL WHERE assigned_to = ${targetIdNum}
    `;

    // 2. Удаляем самого участника
    await sql`
      DELETE FROM santas WHERE telegram_id = ${targetIdNum}
    `;

    return res.status(200).json({ 
      success: true, 
      nickname: target[0].nickname 
    });

  } catch (err) {
    console.error('Ошибка remove-participant:', err);
    return res.status(500).json({ error: err.message });
  }
};
