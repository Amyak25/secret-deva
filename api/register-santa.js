const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;
    const nickname = body.nickname;
    const first_name = body.first_name;
    const last_name = body.last_name;
    const phone = body.phone;
    const ozon_address = body.ozon_address || null;
    const wb_address = body.wb_address || null;
    const cdek_address = body.cdek_address || null;
    const wishes = body.wishes || null;

    if (!telegram_id || !first_name || !last_name || !phone || !nickname) {
      return res.status(400).json({ error: 'Заполните обязательные поля: имя, фамилия, телефон, ник' });
    }

    const telegramIdNum = Number(telegram_id);
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, открыта ли регистрация
    const settings = await sql`SELECT registration_end FROM settings WHERE id = 1`;
    if (settings.length > 0) {
      const regEnd = new Date(settings[0].registration_end + 'Z');
      if (new Date() > regEnd) {
        // Регистрация закрыта. Пропускаем только тех, кто уже есть в базе
        const existing = await sql`
          SELECT id FROM santas WHERE telegram_id = ${telegramIdNum}
        `;
        if (existing.length === 0) {
          return res.status(403).json({ error: 'Регистрация закрыта' });
        }
      }
    }

    // Проверяем, есть ли игрок в базе
    const existing = await sql`
      SELECT id, is_admin FROM santas WHERE telegram_id = ${telegramIdNum}
    `;

    if (existing.length > 0) {
      // Обновляем профиль
      await sql`
        UPDATE santas
        SET nickname = ${nickname},
            first_name = ${first_name},
            last_name = ${last_name},
            phone = ${phone},
            ozon_address = ${ozon_address},
            wb_address = ${wb_address},
            cdek_address = ${cdek_address},
            wishes = ${wishes}
        WHERE telegram_id = ${telegramIdNum}
      `;
      return res.status(200).json({
        registered: false,
        is_admin: existing[0].is_admin,
        telegram_id: telegramIdNum
      });
    }

    // Создаём нового
    const result = await sql`
      INSERT INTO santas (
        telegram_id, nickname, first_name, last_name, phone,
        ozon_address, wb_address, cdek_address, wishes
      )
      VALUES (
        ${telegramIdNum}, ${nickname}, ${first_name}, ${last_name}, ${phone},
        ${ozon_address}, ${wb_address}, ${cdek_address}, ${wishes}
      )
      RETURNING id, is_admin
    `;

    return res.status(200).json({
      registered: true,
      is_admin: result[0].is_admin,
      telegram_id: telegramIdNum
    });

  } catch (err) {
    console.error('Ошибка register-santa:', err);
    return res.status(500).json({ error: err.message });
  }
};
