module.exports = async (req, res) => {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const status = (req.query.status || 'all').toLowerCase();
    const offset = (page - 1) * limit;
    await sql(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        service TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address TEXT
      );
    `);
    const where = status === 'all' ? '' : 'WHERE status = $1';
    const params = status === 'all' ? [] : [status];
    const [{ total }] = await sql(
      `SELECT COUNT(*)::int AS total FROM inquiries ${where}`,
      params
    );
    const rows = await sql(
      `SELECT * FROM inquiries ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      inquiries: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    }));
  } catch (err) {
    console.error('admin inquiries error:', err && (err.stack || err));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'failed to load inquiries' }));
  }
};
