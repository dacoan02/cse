import "server-only";
import nodemailer from "nodemailer";

export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Trimite e-mailul de bun venit cu datele de acces. Întoarce false dacă e-mailul nu e configurat sau trimiterea a eșuat. */
export async function sendWelcomeEmail(o: { to: string; name: string; password: string; roleLabel: string; councilName: string; siteUrl: string }): Promise<boolean> {
  if (!mailConfigured()) return false;
  const fromName = process.env.MAIL_FROM_NAME || "Consiliul Elevilor";
  const fromAddr = process.env.MAIL_FROM || process.env.SMTP_USER!;
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const subject = `Contul tău în aplicația ${o.councilName}`;
  const text = [
    `Bună, ${o.name}!`, "",
    `Ai primit un cont în aplicația ${o.councilName}, cu rolul: ${o.roleLabel}.`, "",
    "Cum intri:",
    `1. Deschide ${o.siteUrl} (în browser sau în aplicația de pe telefon).`,
    `2. Autentifică-te cu:`,
    `   E-mail: ${o.to}`,
    `   Parola inițială: ${o.password}`,
    "3. Schimbă imediat parola: meniul Setări → Schimbă parola.", "",
    "Parola inițială a fost aleasă de conducerea Consiliului. Nu o da nimănui.",
    "Dacă ai probleme la autentificare, scrie președintelui Consiliului.", "",
    o.councilName,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111827">
<h2 style="color:#1d4ed8;margin-bottom:4px">${esc(o.councilName)}</h2>
<p>Bună, <b>${esc(o.name)}</b>!</p>
<p>Ai primit un cont în aplicația Consiliului, cu rolul: <b>${esc(o.roleLabel)}</b>.</p>
<p><b>Cum intri:</b></p>
<ol><li>Deschide <a href="${esc(o.siteUrl)}">${esc(o.siteUrl)}</a> (în browser sau în aplicația de pe telefon).</li>
<li>Autentifică-te cu:<br>E-mail: <b>${esc(o.to)}</b><br>Parola inițială: <b style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px">${esc(o.password)}</b></li>
<li>Schimbă imediat parola: <b>Setări → Schimbă parola</b>.</li></ol>
<p style="color:#6b7280;font-size:14px">Parola inițială a fost aleasă de conducerea Consiliului. Nu o da nimănui. Dacă ai probleme la autentificare, scrie președintelui Consiliului.</p>
<p style="color:#6b7280;font-size:14px">${esc(o.councilName)}</p></div>`;
  try { await transport.sendMail({ from: `"${fromName}" <${fromAddr}>`, to: o.to, subject, text, html }); return true; } catch { return false; }
}
