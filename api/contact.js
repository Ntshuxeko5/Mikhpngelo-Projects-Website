module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { name, email, message, service } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: send email via Resend or store in Neon Postgres
    // Example pseudo-logging:
    console.log('New inquiry:', { name, email, message, service });

    return res.status(200).json({ ok: true, message: 'Inquiry received' });
  } catch (err) {
    console.error('Contact API error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};