
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

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
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
        sql: `
SELECT b.id, b.provider_id, b.service_id,
       b.appointment_date, b.start_time, b.end_time,
       b.status, b.customer_notes,
       p.business_name, s.name AS service_name,
       s.price, s.currency,
       CASE
         WHEN r.id IS NOT NULL THEN 1
         ELSE 0
       END AS has_review
FROM bookings b
JOIN providers p ON p.id = b.provider_id
JOIN services s ON s.id = b.service_id
LEFT JOIN reviews r
  ON r.booking_id = b.id
 AND r.customer_user_id = b.customer_user_id
WHERE b.customer_user_id = ?
ORDER BY b.appointment_date DESC, b.start_time DESC
LIMIT 100
`,
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

    const providerId = Number(body.provider_id);
    const serviceId = Number(body.service_id);
    const date = String(body.appointment_date || "");
    const startTime = String(body.start_time || "");
    const notes = String(body.customer_notes || "").trim();

    if (
      !Number.isSafeInteger(providerId) || providerId < 1 ||
      !Number.isSafeInteger(serviceId) || serviceId < 1 ||
      !validDate(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      notes.length > 1000
    ) {
      return response(400, { message: "تحقق من بيانات الموعد" });
    }

    const today = new Date().toISOString().slice(0, 10);

    if (date < today) {
      return response(400, { message: "لا يمكن الحجز في تاريخ سابق" });
    }

    const serviceResult = await db.execute({
      sql: `SELECT s.id, s.provider_id, s.duration_minutes
            FROM services s
            JOIN providers p ON p.id = s.provider_id
            WHERE s.id = ?
              AND s.provider_id = ?
              AND s.is_active = 1
              AND p.is_published = 1
            LIMIT 1`,
      args: [serviceId, providerId],
    });

    const service = serviceResult.rows[0];

    if (!service) {
      return response(404, {
        message: "النشاط أو الخدمة غير متاح للحجز",
      });
    }

    const [hours, minutes] = startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + Number(service.duration_minutes);

    if (endMinutes > 1440) {
      return response(400, {
        message: "مدة الخدمة تتجاوز نهاية اليوم",
      });
    }

    const endTime =
      `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:` +
      `${String(endMinutes % 60).padStart(2, "0")}`;

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

    const schedule = await db.execute({
      sql: `SELECT id FROM availability
            WHERE provider_id = ?
              AND weekday = ?
              AND is_active = 1
              AND start_time <= ?
              AND end_time >= ?
            LIMIT 1`,
      args: [providerId, weekday, startTime, endTime],
    });

    if (!schedule.rows.length) {
      return response(409, {
        message: "الموعد خارج ساعات العمل المتاحة",
      });
    }

    const tx = await db.transaction("write");

    try {
      const conflict = await tx.execute({
        sql: `SELECT id FROM bookings
              WHERE provider_id = ?
                AND appointment_date = ?
                AND status IN ('pending', 'confirmed')
                AND start_time < ?
                AND end_time > ?
              LIMIT 1`,
        args: [providerId, date, endTime, startTime],
      });

      if (conflict.rows.length) {
        await tx.rollback();

        return response(409, {
          message: "هذا الموعد محجوز بالفعل، اختر وقتًا آخر",
        });
      }

      const inserted = await tx.execute({
        sql: `INSERT INTO bookings
              (customer_user_id, provider_id, service_id,
               appointment_date, start_time, end_time,
               status, customer_notes)
              VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        args: [
          userId,
          providerId,
          serviceId,
          date,
          startTime,
          endTime,
          notes || null,
        ],
      });

      await tx.commit();

      return response(201, {
        message: "تم إرسال طلب الحجز بنجاح",
        booking: {
          id: Number(inserted.lastInsertRowid),
          provider_id: providerId,
          service_id: serviceId,
          appointment_date: date,
          start_time: startTime,
          end_time: endTime,
          status: "pending",
        },
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Bookings API error:", error.message);

    return response(500, {
      message: "تعذر تنفيذ الحجز حاليًا",
    });
  }
};
