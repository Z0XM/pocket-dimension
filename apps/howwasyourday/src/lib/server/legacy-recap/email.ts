export async function sendLegacyRecapOtpEmail(opts: {
  to: string;
  displayName: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = Bun.env.RESEND_API_KEY?.trim();
  const from = Bun.env.RESEND_FROM_EMAIL?.trim() || "noreply@z0xm.com";
  if (!apiKey) {
    console.error("[legacy-recap] RESEND_API_KEY missing; OTP not sent");
    return { ok: false, error: "Email delivery is not configured" };
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Georgia, serif; color: #142326; background: #f3f6f4; padding: 24px;">
        <div style="max-width: 480px; margin: 0 auto; background: #fff; padding: 28px; border: 1px solid #d5e0dc;">
          <p style="margin: 0 0 8px; letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; color: #6a7f83;">
            How Was Your Day · 2025 recap
          </p>
          <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 500;">Your claim code</h1>
          <p style="margin: 0 0 16px; line-height: 1.5;">
            Hi ${escapeHtml(opts.displayName)}, use this code to open your 2025 year recap dashboard.
            It expires in 10 minutes.
          </p>
          <p style="margin: 0 0 20px; font-size: 32px; letter-spacing: 0.35em; font-family: ui-monospace, monospace;">
            ${escapeHtml(opts.code)}
          </p>
          <p style="margin: 0; font-size: 13px; color: #6a7f83;">
            If you did not request this, you can ignore the email.
          </p>
        </div>
      </body>
    </html>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `${opts.code} — claim your 2025 How Was Your Day recap`,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[legacy-recap] OTP email failed", res.status, text);
      return { ok: false, error: "Failed to send email" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[legacy-recap] OTP email failed", err);
    return { ok: false, error: "Failed to send email" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
