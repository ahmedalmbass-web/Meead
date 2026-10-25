
const { getDb } = require("./lib/db");
const { verifyToken } = require("./lib/auth");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function response(statusCode, data) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(data),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return response(405, {
      message: "طريقة الطلب غير مدعومة",
    });
  }

  const token = verifyToken(event);

  if (!token || !Number.isSafeInteger(Number(token.sub))) {
    return response(401, {
      message: "سجّل الدخول أولًا",
    });
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, {
      message: "بيانات الطلب غير صالحة",
    });
  }

  const bookingId = Number(body.booking_id);
  const rating = Number(body.rating);
  const comment =
    typeof body.comment === "string" ? body.comment.trim() : "";

  if (
    !Number.isSafeInteger(bookingId) ||
    bookingId < 1 ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    comment.length > 1000
  ) {
    return response(400, {
      message: "تحقق من رقم الحجز والتقييم والتعليق",
    });
  }

  try {
    const db = getDb();
    const customerId = Number(token.sub);

    const booking = await db.execute({
      sql: `SELECT id, customer_user_id, provider_id, service_id
            FROM bookings
            WHERE id = ?
              AND customer_user_id = ?
              AND status = 'completed'`,
      args: [bookingId, customerId],
    });

    if (!booking.rows.length) {
      return response(403, {
        message: "يمكنك تقييم حجز مكتمل يخص حسابك فقط",
      });
    }

    const existing = await db.execute({
      sql: "SELECT id FROM reviews WHERE booking_id = ?",
      args: [bookingId],
    });

    if (existing.rows.length) {
      return response(409, {
        message: "سبق لك تقييم هذا الحجز",
      });
    }

    await db.execute({
      sql: `INSERT INTO reviews (
              booking_id,
              customer_user_id,
              provider_id,
              service_id,
              rating,
              comment
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        booking.rows[0].id,
        customerId,
        booking.rows[0].provider_id,
        booking.rows[0].service_id,
        rating,
        comment || null,
      ],
    });

    return response(201, {
      message: "تم حفظ تقييمك بنجاح",
    });
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return response(409, {
        message: "سبق تقييم هذا الحجز",
      });
    }

    console.error("Review creation error:", error.message);

    return response(500, {
      message: "تعذر حفظ التقييم حاليًا",
    });
  }
};
