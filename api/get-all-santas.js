const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const admin_id = body.admin_id;

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id обязателен' });
    }

    const adminIdNum = Number(admin_id);
    if (isNaN(adminIdNum)) {
      return res.status(400).json({ error: 'Некорректный admin_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, что это админ
    const requester = await sql`
      SELECT is_admin FROM santas WHERE telegram_id = ${adminIdNum}
    `;
    if (requester.length === 0 || !requester[0].is_admin) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    // Все участники
    const all = await sql`
      SELECT telegram_id, nickname, first_name, last_name, 
             assigned_to, gift_status, is_admin
      FROM santas
      ORDER BY created_at ASC
    `;

    // Создаём словарь: telegram_id -> nickname
    const idToNick = {};
    all.forEach(function(s) {
      idToNick[s.telegram_id] = s.nickname;
    });

    // Формируем ответ — НО скрываем "кому попался сам админ"
    const result = all.map(function(s) {
      let assignedNickname = null;

      if (s.assigned_to) {
        // Скрываем, если это подопечный самого админа, который делает запрос
        // То есть: если assigned_to = admin_id, не показываем
        if (s.assigned_to === adminIdNum) {
          assignedNickname = '🙈 (скрыто)';
        } else {
          assignedNickname = idToNick[s.assigned_to] || 'неизвестно';
        }
      }

      return {
        telegram_id: s.telegram_id,
        nickname: s.nickname,
        first_name: s.first_name,
        last_name: s.last_name,
        gift_status: s.gift_status,
        is_admin: s.is_admin,
        assigned_to: s.assigned_to,
        assigned_nickname: assignedNickname
      };
    });

    return res.status(200).json({
      santas: result,
      total: result.length
    });

  } catch (err) {
    console.error('Ошибка get-all-santas:', err);
    return res.status(500).json({ error: err.message });
  }
};
