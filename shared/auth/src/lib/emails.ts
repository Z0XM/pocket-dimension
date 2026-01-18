import { Resend } from "resend";
import { env } from "./env";

const resend = new Resend(env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    const result = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    });
    return result;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

interface VerificationEmailParams {
  email: string;
  name: string;
  url: string;
}

export async function sendVerificationEmail({ email, name, url }: VerificationEmailParams) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your email</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            margin-bottom: 16px;
            color: #555;
          }
          .button {
            display: inline-block;
            background-color: #6366f1;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #5558e3;
          }
          .link {
            color: #6366f1;
            word-break: break-all;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #888;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Verify your email address</h1>
          <p>Hi ${name},</p>
          <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
          <a href="${url}" class="button">Verify Email Address</a>
          <p>Or copy and paste this link into your browser:</p>
          <p class="link">${url}</p>
          <p>This link will expire in 1 hour.</p>
          <div class="footer">
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Verify your email address",
    html,
  });
}

interface ResetPasswordEmailParams {
  email: string;
  name: string;
  url: string;
}

export async function sendResetPasswordEmail({ email, name, url }: ResetPasswordEmailParams) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            margin-bottom: 16px;
            color: #555;
          }
          .button {
            display: inline-block;
            background-color: #6366f1;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #5558e3;
          }
          .link {
            color: #6366f1;
            word-break: break-all;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #888;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeeba;
            border-radius: 4px;
            padding: 12px;
            margin: 16px 0;
            color: #856404;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Reset your password</h1>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <a href="${url}" class="button">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p class="link">${url}</p>
          <p>This link will expire in 1 hour.</p>
          <div class="warning">
            <strong>Security tip:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
          </div>
          <div class="footer">
            <p>This email was sent because a password reset was requested for your account.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Reset your password",
    html,
  });
}
