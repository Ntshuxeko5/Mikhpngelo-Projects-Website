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
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');

    if (contentType === 'application/json') {
      try {
        return JSON.parse(raw || '{}');
      } catch {
        return {};
      }
    }
    if (contentType === 'application/x-www-form-urlencoded') {
      const params = new URLSearchParams(raw);
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
    // Fallback: try JSON, else empty
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return {};
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(405, { error: 'Method Not Allowed' });
  }

  try {
    // Parse body safely across runtimes
    const body = req.body && typeof req.body === 'object' ? req.body : await parseBody(req);
    const { name, email, message, service } = body || {};
    if (!name || !email || !message) {
      return sendJson(400, { error: 'Missing required fields' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;

    const subject = `New Inquiry${service ? `: ${service}` : ''}`;
    const html = `
      <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6;">
        <h2 style="margin:0 0 12px;">New Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${service ? `<p><strong>Service:</strong> ${service}</p>` : ''}
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap; font-family: inherit;">${message}</pre>
      </div>
    `;

    if (apiKey) {
      // Customer confirmation
      const resp1 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'We received your inquiry',
          html: `
            <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6;">
              <p>Hi ${name},</p>
              <p>Thanks for reaching out. We received your message and will get back to you shortly.</p>
              <hr />
              ${html}
            </div>
          `,
        }),
      });
      if (!resp1.ok) {
        const t = await resp1.text();
        console.error('Resend customer email failed:', resp1.status, t);
      }

      // Admin notification (optional)
      if (adminEmail) {
        const resp2 = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: adminEmail,
            subject,
            html,
          }),
        });
        if (!resp2.ok) {
          const t = await resp2.text();
          console.error('Resend admin email failed:', resp2.status, t);
        }
      }
    } else {
      console.warn('RESEND_API_KEY not set; skipping email sends.');
    }

    return sendJson(200, { ok: true, message: 'Inquiry received' });
  } catch (err) {
    console.error('Contact API error:', err);
    return sendJson(500, { error: 'Internal Server Error' });
  }
};