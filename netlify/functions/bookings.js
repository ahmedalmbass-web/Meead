
"use strict";

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

function getYemenDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Aden",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function getYemenTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Aden",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function getEndTime(startTime, duration) {
  const [hours, minutes] = startTime.split(":").map(Number);

  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + duration;

  if (
    !Number.isSafeInteger(duration) ||
    duration <= 0 ||
    endMinutes > 1440
  ) {
    return null;
  }

  return (
    `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:` +
    `${String(endMinutes % 60).padStart(2, "0")}`
  );
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return response(405, {
      message: "طريقة الطلب غير مدعومة",
    });
  }

  const token = verifyToken(event);

  if (!token) {
    return response(401, {
      message: "سجّل الدخول أولًا",
    });
  }

  let tx = null;

  try {
    const db = getDb();
    const userId = Number(token.sub);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return response(401, {
        message: "جلسة الدخول غير صالحة، سجّل الدخول مجددًا",
      });
    }

    if (event.httpMethod === "GET") {
      const result = await db.execute({
        sql: `
          SELECT
            b.id,
            b.provider_id,
            b.service_id,
            b.appointment_date,
            b.start_time,
            b.end_time,
            b.status,
            b.customer_notes,
            p.business_name,
            s.name AS service_name,
            s.price,
            s.currency,
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

      return response(200, {
        bookings: result.rows,
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

    const providerId = Number(body.provider_id);
    const serviceId = Number(body.service_id);
    const date = String(body.appointment_date || "");
    const startTime = String(body.start_time || "");
    const notes = String(body.customer_notes || "").trim();

    if (
      !Number.isSafeInteger(providerId) ||
      providerId < 1 ||
      !Number.isSafeInteger(serviceId) ||
      serviceId < 1 ||
      !validDate(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      notes.length > 1000
    ) {
      return response(400, {
        message: "تحقق من بيانات الموعد",
      });
    }

    const today = getYemenDate();

if (date < today) {
  return response(400, {
    message: "لا يمكن الحجز في تاريخ سابق",
  });
}

if (date === today && startTime <= getYemenTime()) {
  return response(400, {
    message: "لا يمكن الحجز في وقت مضى، اختر وقتًا قادمًا",
  });
}

    tx = await db.transaction("write");

    const serviceResult = await tx.execute({
      sql: `
        SELECT
          s.id,
          s.provider_id,
          s.duration_minutes
        FROM services s
        JOIN providers p ON p.id = s.provider_id
        WHERE s.id = ?
          AND s.provider_id = ?
          AND s.is_active = 1
          AND p.is_published = 1
        LIMIT 1
      `,
      args: [serviceId, providerId],
    });

    const service = serviceResult.rows[0];

    if (!service) {
      await tx.rollback();
      tx = null;

      return response(404, {
        message: "النشاط أو الخدمة غير متاح للحجز",
      });
    }

    const duration = Number(service.duration_minutes);
    const endTime = getEndTime(startTime, duration);

    if (!endTime) {
      await tx.rollback();
      tx = null;

      return response(400, {
        message: "مدة الخدمة غير صالحة أو تتجاوز نهاية اليوم",
      });
    }

    const weekday = new Date(
      `${date}T00:00:00Z`
    ).getUTCDay();

    const schedule = await tx.execute({
      sql: `
        SELECT id
        FROM availability
        WHERE provider_id = ?
          AND weekday = ?
          AND is_active = 1
          AND start_time <= ?
          AND end_time >= ?
        LIMIT 1
      `,
      args: [providerId, weekday, startTime, endTime],
    });

    if (!schedule.rows.length) {
      await tx.rollback();
      tx = null;

      return response(409, {
        message: "الموعد خارج ساعات العمل المتاحة",
      });
    }

    const conflict = await tx.execute({
      sql: `
        SELECT id
        FROM bookings
        WHERE provider_id = ?
          AND appointment_date = ?
          AND status IN ('pending', 'confirmed')
          AND start_time < ?
          AND end_time > ?
        LIMIT 1
      `,
      args: [providerId, date, endTime, startTime],
    });

    if (conflict.rows.length) {
      await tx.rollback();
      tx = null;

      return response(409, {
        message: "هذا الموعد محجوز بالفعل، اختر وقتًا آخر",
      });
    }

    // إعادة التحقق من الوقت قبل حفظ الحجز
const currentDate = getYemenDate();
const currentTime = getYemenTime();

if (
  date < currentDate ||
  (date === currentDate && startTime <= currentTime)
) {
  await tx.rollback();
  tx = null;

  return response(409, {
    message: "انتهى وقت الموعد، اختر وقتًا قادمًا",
  });
}

    const inserted = await tx.execute({
      sql: `
        INSERT INTO bookings
          (
            customer_user_id,
            provider_id,
            service_id,
            appointment_date,
            start_time,
            end_time,
            status,
            customer_notes
          )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
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
    tx = null;

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
    if (tx) {
      try {
        await tx.rollback();
      } catch (rollbackError) {
        console.error(
          "Bookings rollback error:",
          rollbackError.message
        );
      }
    }

    console.error("Bookings API error:", error.message);

    return response(500, {
      message: "تعذر تنفيذ الحجز حاليًا",
    });
  }
};
