// Vercel serverless function: emails booking requests using Befekadu's Gmail.
// Needs two environment variables in Vercel (Project → Settings → Environment Variables):
//   GMAIL_USER          befekaduberhanu4@gmail.com
//   GMAIL_APP_PASSWORD  16-character Google App Password (not the normal Gmail password)
const nodemailer = require('nodemailer');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SITE = 'https://befekadu.vercel.app';

// ---- acknowledgement email sent to the client ----
function clientText(name, summary) {
  return `Dear ${name},

Thank you for reaching out and requesting a meeting. I have received your request and will review the details shortly.

Your request
${summary.map(([k, v]) => `- ${k}: ${v}`).join('\n')}

What happens next
I will send you a confirmation email within one business day with the final details${/online/i.test(summary.map(r => r[1]).join(' ')) ? ' and the meeting link' : ''}. If you need to change anything in the meantime, simply reply to this email.

I look forward to speaking with you.

Kind regards,

Befekadu Berhanu
Founder, Endebeto Tech | Software Developer
Addis Ababa, Ethiopia
endebeto.com | ${SITE.replace('https://', '')}`;
}

function clientHtml(name, summary) {
  const online = /online/i.test(summary.map(r => r[1]).join(' '));
  const rows = summary.map(([k, v]) => `
    <tr>
      <td style="padding:9px 0;color:#6b7078;font-size:13px;width:110px;vertical-align:top">${esc(k)}</td>
      <td style="padding:9px 0;color:#15171b;font-size:14px;font-weight:600">${esc(v)}</td>
    </tr>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2ed">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ed;padding:32px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
    <tr><td style="background:#15171b;padding:26px 32px">
      <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:-.2px">Befekadu Berhanu</div>
      <div style="color:#3fc596;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px">Founder, Endebeto Tech · Software Developer</div>
    </td></tr>
    <tr><td style="padding:32px 32px 8px;color:#33373d;font-size:15px;line-height:1.65">
      <p style="margin:0 0 16px">Dear ${esc(name)},</p>
      <p style="margin:0 0 22px">Thank you for reaching out and requesting a meeting. I have received your request and will review the details shortly.</p>
      <div style="border:1px solid #e6e2d9;border-left:4px solid #0f7a5c;border-radius:10px;padding:14px 20px;margin:0 0 22px">
        <div style="font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#0f7a5c;margin-bottom:4px">Your request</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </div>
      <p style="margin:0 0 6px;font-weight:bold;color:#15171b">What happens next</p>
      <p style="margin:0 0 22px">I will send you a confirmation email within one business day with the final details${online ? ' and the meeting link' : ''}. If you need to change anything in the meantime, simply reply to this email.</p>
      <p style="margin:0 0 26px">I look forward to speaking with you.</p>
      <p style="margin:0">Kind regards,</p>
    </td></tr>
    <tr><td style="padding:14px 32px 30px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #eeeae2;padding-top:16px;width:100%"><tr><td style="padding-top:16px">
        <div style="font-size:16px;font-weight:bold;color:#15171b">Befekadu Berhanu</div>
        <div style="font-size:13px;color:#6b7078;margin:2px 0 8px">Founder, Endebeto Tech &nbsp;|&nbsp; Software Developer &nbsp;|&nbsp; Addis Ababa, Ethiopia</div>
        <div style="font-size:13px">
          <a href="https://endebeto.com" style="color:#0f7a5c;text-decoration:none;font-weight:bold">endebeto.com</a>
          <span style="color:#c9c4b8">&nbsp;·&nbsp;</span>
          <a href="${SITE}" style="color:#0f7a5c;text-decoration:none;font-weight:bold">${SITE.replace('https://', '')}</a>
          <span style="color:#c9c4b8">&nbsp;·&nbsp;</span>
          <a href="https://www.linkedin.com/in/befekaduberhanu" style="color:#0f7a5c;text-decoration:none;font-weight:bold">LinkedIn</a>
        </div>
      </td></tr></table>
    </td></tr>
  </table>
  <div style="font-family:Arial,sans-serif;font-size:11px;color:#9a9690;margin-top:14px">You received this email because you requested a meeting at ${SITE.replace('https://', '')}.</div>
</td></tr></table>
</body></html>`;
}

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
  const field = k => String(b[k] || '').slice(0, 300);
  const summary = [
    ['Date & time', when],
    ['Format', [field('Meeting format'), field('Tool / place')].filter(Boolean).join(' · ')],
    ['Topic', field('Reason')]
  ].filter(([, v]) => v && v !== '-');

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
      subject: 'Meeting request received | Befekadu Berhanu',
      text: clientText(name, summary),
      html: clientHtml(name, summary)
    });

    return send(res, 200, { success: 'true' });
  } catch (err) {
    console.error('booking mail failed:', err && err.message);
    const auth = /invalid login|username and password|535/i.test(String(err && err.message));
    return send(res, 500, { success: 'false', message: auth ? 'Email login failed (check the Gmail App Password)' : 'Could not send the email' });
  }
};
