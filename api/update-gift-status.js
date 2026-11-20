const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id; // Кто нажимает
    const target_id = body.target_id;     // Кому меняем статус (ID подопечного)
    const new_status = body.new_status;

    if (!telegram_id || !new_status) {
      return res.status(400).json({ error: 'telegram_id и new_status обязательны' });
    }

    const telegramIdNum = Number(telegram_id);
    const targetIdNum = target_id ? Number(target_id) : null;
    
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const validStatuses = ['not_seen', 'chosen', 'bought', 'shipping', 'ready', 'received'];
    if (validStatuses.indexOf(new_status) === -1) {
      return res.status(400).json({ error: 'Неизвестный статус' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // 1. Получаем данные того, кто нажимает
    const me = await sql`SELECT * FROM santas WHERE telegram_id = ${telegramIdNum}`;
    if (me.length === 0) {
      return res.status(404).json({ error: 'Ты не зарегистрирован' });
    }
    const myData = me[0];

    // Если нажимает получатель (кнопка "получено")
    if (new_status === 'received') {
      const santa = await sql`SELECT * FROM santas WHERE assigned_to = ${telegramIdNum}`;
      if (santa.length === 0) {
        return res.status(400).json({ error: 'Тебе ещё не назначен Санта' });
      }
      await sql`UPDATE santas SET gift_status = 'received' WHERE telegram_id = ${santa[0].telegram_id}`;
      return res.status(200).json({ success: true });
    }

    // Если нажимает Санта (меняет статус подарка подопечному)
    if (targetIdNum) {
      // Проверяем, что это действительно его подопечный
      if (myData.assigned_to !== targetIdNum) {
        return res.status(403).json({ error: 'Это не твой подопечный!' });
      }
      
      // Обновляем статус ПОДОПЕЧНОМУ
      await sql`UPDATE santas SET gift_status = ${new_status} WHERE telegram_id = ${targetIdNum}`;
      return res.status(200).json({ success: true });
    }

    // Если target_id не передан, меняем статус себе (на всякий случай)
    await sql`UPDATE santas SET gift_status = ${new_status} WHERE telegram_id = ${telegramIdNum}`;
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Ошибка update-gift-status:', err);
    return res.status(500).json({ error: err.message });
  }
};
