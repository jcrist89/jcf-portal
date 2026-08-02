import nodemailer from "nodemailer";

let cached: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cached;
}

/** Best-effort send — logs and swallows errors instead of throwing, so a
 * misconfigured/unreachable SMTP server never breaks signup, login, or the
 * Stripe webhook (which Stripe will otherwise retry indefinitely on a 500). */
export async function sendMail(opts: { to: string; subject: string; html: string; text: string }) {
  const transport = getTransport();
  if (!transport) {
    console.warn(`[email] SMTP not configured — skipped "${opts.subject}" to ${opts.to}`);
    return;
  }
  const from = process.env.EMAIL_FROM ?? "Jon Crist Fit <jon@joncristfit.com>";
  try {
    await transport.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      encoding: "utf-8",
    });
  } catch (err) {
    console.error(`[email] failed to send "${opts.subject}" to ${opts.to}:`, err);
  }
}
