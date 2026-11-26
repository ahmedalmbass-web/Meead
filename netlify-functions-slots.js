"use strict";

const { getDb } = require("../lib/db");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_DAYS_AHEAD = 90;

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
    if (part.type !== "literal") values[part.type] = part.value;
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

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
  if (!match) return null;

  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number.isFinite(minutes) ? minutes : null;
}

function toTime(minutes) {
  return (
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:` +
    `${String(minutes % 60).padStart(2, "0")}`
  );
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return response(405, { message: "طريقة الطلب غير مدعومة" });
  }

  const params = event.queryStringParameters || {};
  const serviceId = Number(params.service_id);
  const date = String(params.date || "");

  if (!Number.isSafeInteger(serviceId) || serviceId < 1 || !validDate(date)) {
    return response(400, { message: "تحقق من الخدمة والتاريخ" });
  }

  const today = getYemenDate();

  if (date < today) {
    return response(400, { message: "لا يمكن اختيار تاريخ سابق" });
  }

  if (date > addDays(today, MAX_DAYS_AHEAD)) {
    return response(400, {
      message: `يمكن الحجز خلال ${MAX_DAYS_AHEAD} يومًا القادمة فقط`,
    });
  }

  try {
    const db = getDb();

    const serviceResult = await db.execute({
      sql: `
        SELECT s.id, s.provider_id, s.name, s.duration_minutes
        FROM services s
        JOIN providers p ON p.id = s.provider_id
        WHERE s.id = ?
          AND s.is_active = 1
          AND p.is_published = 1
        LIMIT 1
      `,
      args: [serviceId],
    });

    const service = serviceResult.rows[0];

    if (!service) {
      return response(404, { message: "الخدمة غير متاحة للحجز" });
    }

    const duration = Number(service.duration_minutes);

    if (!Number.isSafeInteger(duration) || duration < 5 || duration > 1440) {
      return response(400, { message: "مدة الخدمة غير صالحة" });
    }

    const providerId = Number(service.provider_id);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

    const periodsResult = await db.execute({
      sql: `
        SELECT start_time, end_time
        FROM availability
        WHERE provider_id = ?
          AND weekday = ?
          AND is_active = 1
        ORDER BY start_time
      `,
      args: [providerId, weekday],
    });

    const base = {
      date,
      service: {
        id: Number(service.id),
        name: service.name,
        duration_minutes: duration,
      },
    };

    if (!periodsResult.rows.length) {
      return response(200, {
        ...base,
        closed: true,
        slots: [],
        message: "هذا النشاط لا يعمل في هذا اليوم",
      });
    }

    const bookingsResult = await db.execute({
      sql: `
        SELECT start_time, end_time
        FROM bookings
        WHERE provider_id = ?
          AND appointment_date = ?
          AND status IN ('pending', 'confirmed')
      `,
      args: [providerId, date],
    });

    const busy = bookingsResult.rows
      .map((row) => ({
        start: toMinutes(row.start_time),
        end: toMinutes(row.end_time),
      }))
      .filter((item) => item.start !== null && item.end !== null);

    const nowMinutes = date === today ? toMinutes(getYemenTime()) : -1;

    // الفاصل بين بدايات المواعيد: 30 دقيقة، أو مدة الخدمة إن كانت أقل من 30
    const step = duration < 30 ? Math.max(5, duration) : 30;

    const seen = new Set();
    const slots = [];

    for (const period of periodsResult.rows) {
      const periodStart = toMinutes(period.start_time);
      const periodEnd = toMinutes(period.end_time);

      if (periodStart === null || periodEnd === null) continue;

      for (
        let start = periodStart;
        start + duration <= periodEnd;
        start += step
      ) {
        if (seen.has(start)) continue;
        seen.add(start);

        // الأوقات التي مضت اليوم لا تُعرض
        if (start <= nowMinutes) continue;

        const end = start + duration;
        const taken = busy.some((item) => item.start < end && item.end > start);

        slots.push({
          start: toTime(start),
          end: toTime(end),
          available: !taken,
        });
      }
    }

    slots.sort((a, b) => a.start.localeCompare(b.start));

    return response(200, {
      ...base,
      closed: false,
      slots,
      message: slots.length ? "" : "انتهت أوقات هذا اليوم، اختر يومًا آخر",
    });
  } catch (error) {
    console.error("Slots API error:", error.message);

    return response(500, { message: "تعذر تحميل الأوقات حاليًا" });
  }
};
