
import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.BREVO_SMTP_HOST,
  port: env.BREVO_SMTP_PORT,
  secure: env.BREVO_SMTP_PORT === 465,
  auth: {
    user: env.BREVO_SMTP_USER,
    pass: env.BREVO_SMTP_PASSWORD,
  },
});

export async function sendVerificationEmail(
  email: string,
  fullName: string,
  token: string,
) {
  if (
    !env.BREVO_SMTP_USER ||
    !env.BREVO_SMTP_PASSWORD ||
    !env.BREVO_SENDER_EMAIL
  ) {
    throw new Error("EMAIL_SERVICE_NOT_CONFIGURED");
  }

  const verificationUrl = new URL(
    "/verify-email",
    env.FRONTEND_URL,
  );

  verificationUrl.searchParams.set("token", token);

  await transporter.sendMail({
    from: {
      name: env.BREVO_SENDER_NAME,
      address: env.BREVO_SENDER_EMAIL,
    },
    to: email,
    subject: "Verifikasi Email Akun SESAJI",
    text: [
      `Halo ${fullName},`,
      "",
      "Terima kasih sudah mendaftar di SESAJI.",
      "Silakan verifikasi email melalui tautan berikut:",
      verificationUrl.toString(),
      "",
      "Tautan ini hanya berlaku selama 15 menit.",
      "Jika kamu tidak merasa melakukan pendaftaran, abaikan email ini.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2>Verifikasi Email SESAJI</h2>
        <p>Halo ${escapeHtml(fullName)},</p>
        <p>Terima kasih sudah bergabung dengan SESAJI.</p>
        <p>Silakan klik tombol berikut untuk memverifikasi email:</p>
        <a
          href="${escapeHtml(verificationUrl.toString())}"
          style="display:inline-block;padding:12px 20px;background:#234B3C;color:white;text-decoration:none;border-radius:8px"
        >
          Verifikasi Email
        </a>
        <p>Tautan berlaku selama 15 menit.</p>
        <p>Jika kamu tidak merasa melakukan pendaftaran, abaikan email ini.</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] ?? character;
  });
}
