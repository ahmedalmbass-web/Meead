
const { getDb } = require("../lib/db");
const { verifyToken } = require("../lib/auth");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return response(405, { message: "طريقة الطلب غير مدعومة" });
  }

  const token = verifyToken(event);

  if (!token) {
    return response(401, { message: "سجّل الدخول أولًا" });
  }

  try {
    const db = getDb();
    const userId = Number(token.sub);

    if (event.httpMethod === "GET") {
      const result = await db.execute({
        sql: `SELECT
                b.id,
                b.appointment_date,
                b.start_time,
                b.end_time,
                b.status,
                b.customer_notes,
                s.name AS service_name,
                s.price,
                s.currency,
                p.id AS provider_id,
                p.business_name,
                u.name AS customer_name,
                u.phone AS customer_phone
              FROM bookings b
              JOIN providers p ON p.id = b.provider_id
              JOIN services s ON s.id = b.service_id
              JOIN users u ON u.id = b.customer_user_id
              WHERE p.owner_user_id = ?
              ORDER BY b.appointment_date DESC, b.start_time DESC`,
        args: [userId],
      });

      return response(200, { bookings: result.rows });
    }

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { message: "بيانات الطلب غير صالحة" });
    }

    const bookingId = Number(body.booking_id);
    const status = body.status;

    if (
  !Number.isSafeInteger(bookingId) ||
  bookingId < 1 ||
  !["confirmed", "cancelled", "completed"].includes(status)
) {
  return response(400, { message: "بيانات الحجز غير صحيحة" });
    } {
      return response(400, { message: "بيانات الحجز غير صحيحة" });
    }

    const result = await db.execute({
  sql: `UPDATE bookings
        SET status = ?
        WHERE id = ?
          AND provider_id IN (
            SELECT id
            FROM providers
            WHERE owner_user_id = ?
          )
          AND (
            (status = 'pending' AND ? IN ('confirmed', 'cancelled'))
            OR
            (status = 'confirmed' AND ? = 'completed')
          )`,
  args: [status, bookingId, userId, status, status],
});

    if (Number(result.rowsAffected) === 0) {
      return response(404, {
        message: "الحجز غير موجود أو لا يمكن تعديل حالته",
      });
    }

    return response(200, {
      message:
        status === "confirmed"
          ? "تم تأكيد الحجز"
          : "تم إلغاء الحجز",
      booking_id: bookingId,
      status,
    });
  } catch (error) {
    console.error("Booking management error:", error.message);

    return response(500, {
      message: "تعذرت معالجة الحجز حاليًا",
    });
  }
};
