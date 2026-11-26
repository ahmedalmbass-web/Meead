"use strict";

const crypto = require("crypto");

// مفتاح مجهول للزائر (نخزّن hash للـ IP وليس الـ IP نفسه)
function clientKey(event) {
  const h = event.headers || {};

  const ip =
    h["x-nf-client-connection-ip"] ||
    h["client-ip"] ||
    String(h["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unknown";

  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

// يزيد العدّاد ويرجع هل ما زال الطلب مسموحًا
async function rateLimit(db, key, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);

  const result = await db.execute({
    sql: `
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE
          WHEN ? - window_start >= ? THEN 1
          ELSE count + 1
        END,
        window_start = CASE
          WHEN ? - window_start >= ? THEN ?
          ELSE window_start
        END
      RETURNING count, window_start
    `,
    args: [key, now, now, windowSeconds, now, windowSeconds, now],
  });

  const row = result.rows[0];
  const count = Number(row.count);
  const windowStart = Number(row.window_start);

  // تنظيف عشوائي للسجلات القديمة (حوالي 1% من الطلبات)
  if (Math.random() < 0.01) {
    await db
      .execute({
        sql: "DELETE FROM rate_limits WHERE window_start < ?",
        args: [now - 86400],
      })
      .catch(() => {});
  }

  return {
    allowed: count <= limit,
    retryAfter: Math.max(1, windowStart + windowSeconds - now),
  };
}

async function clearLimit(db, key) {
  await db.execute({
    sql: "DELETE FROM rate_limits WHERE key = ?",
    args: [key],
  });
}

module.exports = { clientKey, rateLimit, clearLimit };
