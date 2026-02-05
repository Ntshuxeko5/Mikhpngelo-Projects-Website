module.exports = async (req, res) => {
  // Helpers: send JSON and parse request body
  function sendJson(status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  }

  async function parseBody(req) {
    const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');

    if (contentType === 'application/json') {
      try { return JSON.parse(raw || '{}'); } catch { return {}; }
    }
    if (contentType === 'application/x-www-form-urlencoded') {
      const params = new URLSearchParams(raw || '');
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : await parseBody(req);
    const email = body?.email;
    const message = body?.message;
    const service = body?.service || '';
    const firstName = body?.firstName || (body?.name ? String(body.name).split(' ')[0] : '');
    const lastName = body?.lastName || (body?.name ? String(body.name).split(' ').slice(1).join(' ') : '');
    if (!firstName || !email || !message) {
      return sendJson(400, { ok: false, error: 'Missing required fields' });
    }

    const ipAddress = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
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
      const [{ id }] = await sql(
        `INSERT INTO inquiries (firstName, lastName, email, phone, service, message, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [firstName, lastName, email, body?.phone || '', service, message, ipAddress]
      );

      const apiKey = process.env.RESEND_API_KEY;
      const adminEmail = process.env.ADMIN_EMAIL || 'chabalalapretty2@gmail.com';
      if (apiKey) {
        const subject = `New Inquiry${service ? `: ${service}` : ''}`;
        const html = `
          <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6;">
            <h2 style="margin:0 0 12px;">New Inquiry #${id}</h2>
            <p><strong>Name:</strong> ${firstName} ${lastName || ''}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${service ? `<p><strong>Service:</strong> ${service}</p>` : ''}
            <p><strong>Message:</strong></p>
            <pre style="white-space:pre-wrap; font-family: inherit;">${message}</pre>
          </div>
        `;
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'noreply@mikhongeloprojects.com',
            to: email,
            subject: 'We received your inquiry',
            html
          })
        }).catch(() => {});
        if (adminEmail) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'noreply@mikhongeloprojects.com', to: adminEmail, subject, html })
          }).catch(() => {});
        }
      }

      return sendJson(200, { ok: true, inquiryId: id, message: 'Inquiry received' });
    } catch (dbErr) {
      console.error('DB/email error:', dbErr && (dbErr.stack || dbErr));
      return sendJson(200, { ok: false, error: 'Failed to persist inquiry' });
    }
  } catch (err) {
    console.error('Contact API error:', err && (err.stack || err));
    return sendJson(200, { ok: false, error: 'Contact API error' });
  }
};
