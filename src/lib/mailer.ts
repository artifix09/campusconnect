import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "./env";
import { logger, maskEmail } from "./logger";

export type Email = { to: string; subject: string; text: string; html: string };

interface Mailer {
  send(email: Email): Promise<void>;
}

class ResendMailer implements Mailer {
  private readonly client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }
  async send(email: Email) {
    const { error } = await this.client.emails.send({ from: env.EMAIL_FROM, ...email });
    if (error) throw new Error(`Resend rejected the email: ${error.message}`);
  }
}

class SmtpMailer implements Mailer {
  private readonly transport;
  constructor(host: string, port: number) {
    this.transport = nodemailer.createTransport({ host, port, secure: port === 465 });
  }
  async send(email: Email) {
    await this.transport.sendMail({ from: env.EMAIL_FROM, ...email });
  }
}

class LogMailer implements Mailer {
  async send(email: Email) {
    logger.info({ to: maskEmail(email.to), subject: email.subject, preview: email.text }, "Email (not sent, no mailer configured)");
  }
}

const mailer: Mailer = env.RESEND_API_KEY
  ? new ResendMailer(env.RESEND_API_KEY)
  : env.SMTP_HOST
    ? new SmtpMailer(env.SMTP_HOST, env.SMTP_PORT)
    : new LogMailer();

export function sendEmail(email: Email) {
  return mailer.send(email);
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A plain, accessible layout shared by every email. Content is escaped. */
export function emailLayout(opts: { heading: string; paragraphs: string[]; action?: { label: string; url: string } }) {
  const button = opts.action
    ? `<p style="margin:24px 0"><a href="${escape(opts.action.url)}" style="background:#1f4fd1;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${escape(opts.action.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Segoe UI,Arial,sans-serif;color:#141a2e">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-weight:700;font-size:18px;margin:0 0 20px">CampusConnect</p>
<div style="background:#ffffff;border:1px solid #d9deea;border-radius:10px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${escape(opts.heading)}</h1>
${opts.paragraphs.map((p) => `<p style="line-height:1.6;margin:0 0 12px">${escape(p)}</p>`).join("")}
${button}
</div>
<p style="color:#59627a;font-size:12px;margin-top:16px">You received this email because you have a CampusConnect account.</p>
</div></body></html>`;
  const text = [opts.heading, "", ...opts.paragraphs, ...(opts.action ? ["", `${opts.action.label}: ${opts.action.url}`] : [])].join("\n");
  return { html, text };
}
