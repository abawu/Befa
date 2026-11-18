// Vercel serverless function: emails booking requests using Befekadu's Gmail.
// Needs two environment variables in Vercel (Project → Settings → Environment Variables):
//   GMAIL_USER          befekaduberhanu4@gmail.com
//   GMAIL_APP_PASSWORD  16-character Google App Password (not the normal Gmail password)
const nodemailer = require('nodemailer');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const send = (res, code, obj) => { res.setHeader('Content-Type', 'application/json'); res.status(code).send(JSON.stringify(obj)); };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { success: 'false', message: 'Method not allowed' });

  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return send(res, 503, { success: 'false', message: 'Email relay not configured' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object' || b._honey) return send(res, 400, { success: 'false', message: 'Invalid booking request' });
  const email = String(b.email || '').trim(), name = String(b.Name || '').trim().slice(0, 120);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || JSON.stringify(b).length > 20000)
    return send(res, 400, { success: 'false', message: 'Please provide a valid name and email' });

  // every field the page sent, except internal "_" ones
  const rows = Object.entries(b).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k === 'email' ? 'Email' : k, String(v).slice(0, 2000)]);
  const calRow = rows.find(([k]) => k === 'Add to your calendar');
  const tableRows = rows.filter(r => r !== calRow).map(([k, v]) =>
    `<tr><td style="padding:10px 14px;border-bottom:1px solid #eee;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:600">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const when = String(b['Requested time (EAT)'] || '').slice(0, 200);

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  try {
    // 1) notification to Befekadu (reply goes straight to the client)
    await transporter.sendMail({
      from: `"Website booking" <${user}>`,
      to: user,
      replyTo: `"${name.replace(/"/g, '')}" <${email}>`,
      subject: `New meeting request: ${name} · ${when}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:620px">
        <h2 style="margin:0 0 6px">New meeting request</h2>
        <p style="margin:0 0 16px;color:#555">Reply to this email to confirm with ${esc(name)}.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">${tableRows}</table>
        ${calRow ? `<p style="margin:20px 0"><a href="${esc(calRow[1])}" style="background:#0f7a5c;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Add to my Google Calendar</a></p>` : ''}
      </div>`
    });

    // 2) acknowledgement to the client, from Befekadu's address
    await transporter.sendMail({
      from: `"Befekadu Berhanu" <${user}>`,
      to: email,
      replyTo: user,
      subject: 'Your meeting request with Befekadu Berhanu',
      text: `Hi ${name},\n\nThank you for requesting a meeting with me${when ? ' on ' + when : ''}. I've received your request, and a confirmation email from me will be sent to you soon with the final details.\n\nBest regards,\nBefekadu Berhanu`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;font-size:15px;line-height:1.6">
        <p>Hi ${esc(name)},</p>
        <p>Thank you for requesting a meeting with me${when ? ` on <b>${esc(when)}</b>` : ''}. I've received your request, and <b>a confirmation email from me will be sent to you soon</b> with the final details.</p>
        <p>Best regards,<br><b>Befekadu Berhanu</b><br><span style="color:#666">Founder, Endebeto · Software Development Mentor</span></p>
      </div>`
    });

    return send(res, 200, { success: 'true' });
  } catch (err) {
    console.error('booking mail failed:', err && err.message);
    const auth = /invalid login|username and password|535/i.test(String(err && err.message));
    return send(res, 500, { success: 'false', message: auth ? 'Email login failed (check the Gmail App Password)' : 'Could not send the email' });
  }
};
