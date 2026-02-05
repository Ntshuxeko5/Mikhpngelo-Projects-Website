module.exports = async (req, res) => {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
  }
  try {
    const id = parseInt((req.query.id || '').toString(), 10);
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch {}
    const status = body.status;
    if (!Number.isFinite(id)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Missing id' }));
    }
    if (!['new', 'in-progress', 'resolved', 'closed'].includes(status)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Invalid status' }));
    }
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    await sql('UPDATE inquiries SET status = $1 WHERE id = $2', [status, id]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, message: 'Status updated successfully' }));
  } catch (err) {
    console.error('update status error:', err && (err.stack || err));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'failed to update status' }));
  }
};
