
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

function validTime(value) {
  return typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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

if (!Number.isSafeInteger(userId) || userId < 1) {
  return response(401, {
    message: "جلسة الدخول غير صالحة، سجّل الدخول مجددًا",
  });
}

const params = event.queryStringParameters || {};

    let body = {};

    if (event.httpMethod === "POST") {
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { message: "بيانات الطلب غير صالحة" });
      }
    }

    const providerId = Number(
      event.httpMethod === "POST"
        ? body.provider_id
        : params.providerId
    );

    if (!Number.isSafeInteger(providerId) || providerId < 1) {
      return response(400, { message: "معرّف النشاط غير صالح" });
    }

    const owner = await db.execute({
      sql: `SELECT id FROM providers
            WHERE id = ? AND owner_user_id = ?`,
      args: [providerId, userId],
    });

    if (!owner.rows.length) {
      return response(403, {
        message: "لا تملك صلاحية إدارة ساعات هذا النشاط",
      });
    }

    if (event.httpMethod === "GET") {
      const result = await db.execute({
        sql: `SELECT id, provider_id, weekday,
                     start_time, end_time, is_active
              FROM availability
              WHERE provider_id = ?
              ORDER BY weekday, start_time`,
        args: [providerId],
      });

      return response(200, { availability: result.rows });
    }

    const weekday = Number(body.weekday);

    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6
    ) {
      return response(400, { message: "يوم العمل غير صالح" });
    }

    if (body.action === "disable") {
      await db.execute({
        sql: `UPDATE availability
              SET is_active = 0
              WHERE provider_id = ? AND weekday = ?`,
        args: [providerId, weekday],
      });

      return response(200, {
        message: "تم إغلاق يوم العمل",
        provider_id: providerId,
        weekday,
      });
    }

    const startTime = body.start_time;
    const endTime = body.end_time;

    if (
      !validTime(startTime) ||
      !validTime(endTime) ||
      startTime >= endTime
    ) {
      return response(400, {
        message: "تحقق من اليوم ووقت البداية والنهاية",
      });
    }

        const overlap = await db.execute({
      sql: `SELECT id
            FROM availability
            WHERE provider_id = ?
              AND weekday = ?
              AND is_active = 1
              AND start_time < ?
              AND end_time > ?
            LIMIT 1`,
      args: [providerId, weekday, endTime, startTime],
    });

    if (overlap.rows.length) {
      return response(409, {
        message: "تتداخل هذه الفترة مع ساعات عمل محفوظة، اختر فترة أخرى",
      });
    }

    await db.execute({
      sql: `INSERT INTO availability
            (provider_id, weekday, start_time, end_time, is_active)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(provider_id, weekday, start_time, end_time)
            DO UPDATE SET is_active = 1`,
      args: [providerId, weekday, startTime, endTime],
    });

    return response(201, {
      message: "تم حفظ ساعات العمل",
      provider_id: providerId,
      weekday,
      start_time: startTime,
      end_time: endTime,
    });
  } catch (error) {
    console.error("Availability API error:", error.message);

    return response(500, {
      message: "تعذر حفظ ساعات العمل حاليًا",
    });
  }
};
