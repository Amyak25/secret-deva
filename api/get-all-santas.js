
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const body = req.body || {};
    const admin_id = body.admin_id;

    if (!admin_id) {
      return res.status(400).json({
        error: 'admin_id обязателен'
      });
    }

    const adminIdNum = Number(admin_id);

    if (!Number.isSafeInteger(adminIdNum) || adminIdNum <= 0) {
      return res.status(400).json({
        error: 'Некорректный admin_id'
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем права администратора
    const requester = await sql`
      SELECT telegram_id, is_admin
      FROM santas
      WHERE telegram_id = ${adminIdNum}
      LIMIT 1
    `;

    if (requester.length === 0 || !requester[0].is_admin) {
      return res.status(403).json({
        error: 'Нет прав'
      });
    }

    // Получаем всех участников
    const all = await sql`
      SELECT
        telegram_id,
        nickname,
        first_name,
        last_name,
        wishes,
        assigned_to,
        gift_status,
        is_admin,
        is_observer
      FROM santas
      ORDER BY created_at ASC
    `;

    // Создаём словарь участников
    const idToNick = {};

    all.forEach(function(s) {
      idToNick[String(s.telegram_id)] = s.nickname;
    });

    // Формируем результат
    const result = all.map(function(s) {
      let assignedNickname = null;

      if (s.assigned_to != null) {

        // Скрываем того, кто дарит подарок текущему админу
        if (String(s.assigned_to) === String(adminIdNum)) {
          assignedNickname = '🙈 (скрыто)';
        } else {
          assignedNickname =
            idToNick[String(s.assigned_to)] || 'неизвестно';
        }
      }

      return {
        telegram_id: s.telegram_id,
        nickname: s.nickname,
        first_name: s.first_name,
        last_name: s.last_name,
        wishes: s.wishes,
        gift_status: s.gift_status || 'not_seen',
        is_admin: s.is_admin,
        is_observer: s.is_observer,
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

    return res.status(500).json({
      error: 'Ошибка сервера при загрузке участников'
    });
  }
};
