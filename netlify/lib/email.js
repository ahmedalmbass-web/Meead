"use strict";

// إرسال الإيميل عبر Resend. لتبديل الخدمة لاحقًا غيّر هذا الملف فقط.
//
// متغيرات البيئة في Netlify:
//   RESEND_API_KEY  مفتاح الخدمة
//   EMAIL_FROM      المرسِل، مثل:  ميعاد <no-reply@yourdomain.com>
//   EMAIL_DEV_MODE  "true" فقط أثناء التجربة قبل ربط الدومين (يطبع الكود في سجل Netlify)

async function sendVerificationEmail(to, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.EMAIL_DEV_MODE === "true") {
      console.log(`[DEV ONLY] Verification code for ${to}: ${code}`);
      return;
    }

    throw new Error("Email service is not configured");
  }

  const subject = "رمز التحقق من حسابك في ميعاد";

  const text =
    `رمز التحقق الخاص بك في ميعاد: ${code}\n` +
    "صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز فتجاهل الرسالة.";

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:20px;color:#1b2b26">
      <h2 style="color:#123c32;margin:0 0 12px">ميعاد</h2>
      <p>رمز التحقق من بريدك الإلكتروني:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f7f6f0;border-radius:10px;padding:14px;text-align:center;margin:16px 0">${code}</p>
      <p style="color:#75817b;font-size:13px">الرمز صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز فتجاهل الرسالة.</p>
    </div>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Email provider error ${response.status}: ${detail.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendVerificationEmail };
