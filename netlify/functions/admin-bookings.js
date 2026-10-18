
const { getDb } = require("../lib/db");
const { verifyToken } = require("../lib/auth");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (event.httpMethod !== "GET") {
    return response(405, { message: "طريقة الطلب غير مدعومة" });
  }

  const token = verifyToken(event);

  if (!token || !Number.isSafeInteger(Number(token.sub))) {
    return response(401, { message: "سجّل الدخول مجددًا" });
  }

  try {
    const db = getDb();

    const account = await db.execute({
      sql: "SELECT role FROM users WHERE id = ? LIMIT 1",
      args: [Number(token.sub)],
    });

    if (!account.rows[0] || account.rows[0].role !== "admin") {
      return response(403, {
        message: "ليس لديك صلاحية إدارة الحجوزات",
      });
    }

    const result = await db.execute({
      sql: `SELECT
              b.id,
              b.appointment_date,
              b.start_time,
              b.end_time,
              b.status,
              b.customer_notes,
              b.created_at,
              customer.name AS customer_name,
              customer.email AS customer_email,
              p.business_name,
              s.name AS service_name,
              s.price,
              s.currency
            FROM bookings b
            LEFT JOIN users customer
              ON customer.id = b.customer_user_id
            LEFT JOIN providers p
              ON p.id = b.provider_id
            LEFT JOIN services s
              ON s.id = b.service_id
            ORDER BY b.appointment_date DESC, b.start_time DESC
            LIMIT 200`,
      args: [],
    });

    return response(200, {
      bookings: result.rows,
    });
  } catch (error) {
    console.error("Admin bookings error:", error.message);

    return response(500, {
      message: "تعذر تحميل الحجوزات حاليًا",
    });
  }
};
