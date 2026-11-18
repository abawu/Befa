// Vercel serverless function: relays booking requests from the website to FormSubmit.
// Visitors only talk to this site, so networks that block formsubmit.co don't break booking.
const OWNER = 'befekaduberhanu4@gmail.com';
const FORMSUBMIT = 'https://formsubmit.co/ajax/' + OWNER;

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.status(405).send(JSON.stringify({ success: 'false', message: 'Method not allowed' }));
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const raw = body ? JSON.stringify(body) : '';
  if (!body || typeof body !== 'object' || !body.email || !body.Name || raw.length > 20000 || body._honey) {
    res.status(400).send(JSON.stringify({ success: 'false', message: 'Invalid booking request' }));
    return;
  }

  const site = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  try {
    const r = await fetch(FORMSUBMIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: site, Referer: site + '/' },
      body: raw
    });
    const text = await r.text();
    res.status(r.ok ? 200 : r.status).send(text || JSON.stringify({ success: 'false', message: `Email service returned ${r.status}` }));
  } catch (err) {
    res.status(502).send(JSON.stringify({ success: 'false', message: 'Could not reach the email service' }));
  }
};
