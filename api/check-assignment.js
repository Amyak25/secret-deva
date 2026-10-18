const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const total = await sql`
      SELECT COUNT(*)::int AS cnt FROM santas
    `;

    const assigned = await sql`
      SELECT COUNT(*)::int AS cnt FROM santas WHERE assigned_to IS NOT NULL
    `;

    const totalCount = total[0] ? total[0].cnt : 0;
    const assignedCount = assigned[0] ? assigned[0].cnt : 0;

    return res.status(200).json({
      total_participants: totalCount,
      assigned_participants: assignedCount,
      assignment_done: totalCount > 0 && assignedCount === totalCount
    });

  } catch (err) {
    console.error('Ошибка check-assignment:', err);
    return res.status(500).json({ error: err.message });
  }
};
