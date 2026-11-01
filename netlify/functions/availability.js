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

function validTime(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

function validatePeriods(periods) {
  if (!Array.isArray(periods)) {
    return "قائمة فترات العمل غير صالحة.";
  }

  if (periods.length > 20) {
    return "لا يمكن إضافة أكثر من 20 فترة في اليوم.";
  }

  const normalized = [];

  for (const period of periods) {
    if (
      !period ||
      !validTime(period.start_time) ||
      !validTime(period.end_time) ||
      period.start_time >= period.end_time
    ) {
      return "تحقق من أوقات البداية والنهاية لكل فترة.";
    }

    normalized.push({
      start_time: period.start_time,
      end_time: period.end_time,
    });
  }

  normalized.sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  for (let i = 1; i < normalized.length; i++) {
    if (
      normalized[i].start_time <
      normalized[i - 1].end_time
    ) {
      return "توجد فترات عمل متداخلة. عدّل الأوقات أولًا.";
    }
  }

  return normalized;
}

function validateWeek(days) {
  if (!Array.isArray(days) || days.length !== 7) {
    return "يجب إرسال بيانات أيام الأسبوع السبعة.";
  }

  const normalizedDays = [];
  const seenWeekdays = new Set();

  for (const day of days) {
    if (!day || !Number.isInteger(day.weekday) ||
        day.weekday < 0 || day.weekday > 6) {
      return "أحد أيام الأسبوع غير صالح.";
    }

    if (seenWeekdays.has(day.weekday)) {
      return "يوجد يوم مكرر في بيانات الأسبوع.";
    }

    seenWeekdays.add(day.weekday);

    const periods = validatePeriods(day.periods);

    if (typeof periods === "string") {
      return `اليوم ${day.weekday}: ${periods}`;
    }

    normalizedDays.push({
      weekday: day.weekday,
      periods,
    });
  }

  normalizedDays.sort((a, b) => a.weekday - b.weekday);

  for (let i = 0; i < 7; i++) {
    if (normalizedDays[i].weekday !== i) {
      return "بيانات أيام الأسبوع غير مكتملة.";
    }
  }

  return normalizedDays;
}

async function replaceDay(transaction, providerId, weekday, periods) {
  await transaction.execute({
    sql: `UPDATE availability
          SET is_active = 0
          WHERE provider_id = ?
            AND weekday = ?`,
    args: [providerId, weekday],
  });

  for (const period of periods) {
    await transaction.execute({
      sql: `INSERT INTO availability
            (provider_id, weekday, start_time, end_time, is_active)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(provider_id, weekday, start_time, end_time)
            DO UPDATE SET is_active = 1`,
      args: [
        providerId,
        weekday,
        period.start_time,
        period.end_time,
      ],
    });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
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

  let transaction;

  try {
    const db = getDb();
    const userId = Number(token.sub);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return response(401, {
        message: "جلسة الدخول غير صالحة، سجّل الدخول مجددًا",
      });
    }

    const userResult = await db.execute({
      sql: `SELECT id, role
            FROM users
            WHERE id = ?
            LIMIT 1`,
      args: [userId],
    });

    if (
      !userResult.rows.length ||
      userResult.rows[0].role !== "provider"
    ) {
      return response(403, {
        message: "هذه العملية متاحة لمقدمي الخدمات فقط.",
      });
    }

    const params = event.queryStringParameters || {};

    let body = {};

    if (event.httpMethod === "POST") {
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, {
          message: "بيانات الطلب غير صالحة",
        });
      }
    }

    const providerId = Number(
      event.httpMethod === "POST"
        ? body.provider_id
        : params.providerId
    );

    if (!Number.isSafeInteger(providerId) || providerId < 1) {
      return response(400, {
        message: "معرّف النشاط غير صالح",
      });
    }

    const owner = await db.execute({
      sql: `SELECT id
            FROM providers
            WHERE id = ? AND owner_user_id = ?`,
      args: [providerId, userId],
    });

    if (!owner.rows.length) {
      return response(403, {
        message: "لا تملك صلاحية إدارة ساعات هذا النشاط",
      });
    }

    // تحميل ساعات العمل
    if (event.httpMethod === "GET") {
      const result = await db.execute({
        sql: `SELECT id, provider_id, weekday,
                     start_time, end_time, is_active
              FROM availability
              WHERE provider_id = ?
              ORDER BY weekday, start_time`,
        args: [providerId],
      });

      return response(200, {
        availability: result.rows,
      });
    }

    // حفظ الأسبوع كاملًا داخل معاملة واحدة
    if (body.action === "replace_week") {
      const days = validateWeek(body.days);

      if (typeof days === "string") {
        return response(400, {
          message: days,
        });
      }

      transaction = await db.transaction("write");

      for (const day of days) {
        await replaceDay(
          transaction,
          providerId,
          day.weekday,
          day.periods
        );
      }

      await transaction.commit();
      transaction = null;

      return response(200, {
        message: "تم تحديث ساعات العمل للأسبوع كاملًا بنجاح.",
        provider_id: providerId,
        days,
      });
    }

    const weekday = Number(body.weekday);

    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6
    ) {
      return response(400, {
        message: "يوم العمل غير صالح",
      });
    }

    // استبدال جميع فترات يوم واحد
    if (body.action === "replace_day") {
      const periods = validatePeriods(body.periods);

      if (typeof periods === "string") {
        return response(400, {
          message: periods,
        });
      }

      transaction = await db.transaction("write");

      await replaceDay(
        transaction,
        providerId,
        weekday,
        periods
      );

      await transaction.commit();
      transaction = null;

      return response(200, {
        message: periods.length
          ? "تم تحديث فترات العمل بنجاح."
          : "تم إغلاق يوم العمل.",
        provider_id: providerId,
        weekday,
        periods,
      });
    }

    // إغلاق يوم كامل بالطريقة القديمة
    if (body.action === "disable") {
      await db.execute({
        sql: `UPDATE availability
              SET is_active = 0
              WHERE provider_id = ?
                AND weekday = ?`,
        args: [providerId, weekday],
      });

      return response(200, {
        message: "تم إغلاق يوم العمل",
        provider_id: providerId,
        weekday,
      });
    }

    // إضافة فترة واحدة بالطريقة القديمة
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
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "Availability rollback error:",
          rollbackError.message
        );
      }
    }

    console.error(
      "Availability API error:",
      error.message
    );

    return response(500, {
      message: "تعذر حفظ ساعات العمل حاليًا",
    });
  }
};
