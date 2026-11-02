
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
    if (normalized[i].start_time < normalized[i - 1].end_time) {
      return "توجد فترات عمل متداخلة. عدّل الأوقات أولًا.";
    }
  }

  return normalized;
}

function validateWeek(days) {
  if (!Array.isArray(days) || days.length !== 7) {
    return "يجب إرسال بيانات أيام الأسبوع السبعة.";
  }

  const normalized = [];
  const seen = new Set();

  for (const day of days) {
    if (
      !day ||
      !Number.isInteger(day.weekday) ||
      day.weekday < 0 ||
      day.weekday > 6
    ) {
      return "أحد أيام الأسبوع غير صالح.";
    }

    if (seen.has(day.weekday)) {
      return "يوجد يوم مكرر في بيانات الأسبوع.";
    }

    seen.add(day.weekday);

    const periods = validatePeriods(day.periods);

    if (typeof periods === "string") {
      return `اليوم ${day.weekday}: ${periods}`;
    }

    normalized.push({
      weekday: day.weekday,
      periods,
    });
  }

  normalized.sort((a, b) => a.weekday - b.weekday);

  for (let i = 0; i < 7; i++) {
    if (normalized[i].weekday !== i) {
      return "بيانات أيام الأسبوع غير مكتملة.";
    }
  }

  return normalized;
}

function getWeekday(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function bookingFitsPeriods(booking, periods) {
  return periods.some(
    (period) =>
      period.start_time <= booking.start_time &&
      period.end_time >= booking.end_time
  );
}

async function getFutureBookings(tx, providerId, weekdays, today) {
  const placeholders = weekdays.map(() => "?").join(",");

  const result = await tx.execute({
    sql: `
      SELECT appointment_date, start_time, end_time
      FROM bookings
      WHERE provider_id = ?
        AND appointment_date >= ?
        AND status IN ('pending', 'confirmed')
        AND CAST(strftime('%w', appointment_date) AS INTEGER)
            IN (${placeholders})
    `,
    args: [providerId, today, ...weekdays],
  });

  return result.rows;
}

async function replaceDay(tx, providerId, weekday, periods) {
  await tx.execute({
    sql: `
      UPDATE availability
      SET is_active = 0
      WHERE provider_id = ?
        AND weekday = ?
    `,
    args: [providerId, weekday],
  });

  for (const period of periods) {
    await tx.execute({
      sql: `
        INSERT INTO availability
          (provider_id, weekday, start_time, end_time, is_active)
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(provider_id, weekday, start_time, end_time)
        DO UPDATE SET is_active = 1
      `,
      args: [
        providerId,
        weekday,
        period.start_time,
        period.end_time,
      ],
    });
  }
}

async function addLegacyPeriod(
  tx,
  providerId,
  weekday,
  startTime,
  endTime
) {
  const overlap = await tx.execute({
    sql: `
      SELECT id
      FROM availability
      WHERE provider_id = ?
        AND weekday = ?
        AND is_active = 1
        AND start_time < ?
        AND end_time > ?
      LIMIT 1
    `,
    args: [providerId, weekday, endTime, startTime],
  });

  if (overlap.rows.length) return false;

  await tx.execute({
    sql: `
      INSERT INTO availability
        (provider_id, weekday, start_time, end_time, is_active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(provider_id, weekday, start_time, end_time)
      DO UPDATE SET is_active = 1
    `,
    args: [providerId, weekday, startTime, endTime],
  });

  return true;
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

    const userResult = await db.execute({
      sql: `
        SELECT id, role
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
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
      sql: `
        SELECT id
        FROM providers
        WHERE id = ? AND owner_user_id = ?
        LIMIT 1
      `,
      args: [providerId, userId],
    });

    if (!owner.rows.length) {
      return response(403, {
        message: "لا تملك صلاحية إدارة ساعات هذا النشاط",
      });
    }

    if (event.httpMethod === "GET") {
      const result = await db.execute({
        sql: `
          SELECT id, provider_id, weekday,
                 start_time, end_time, is_active
          FROM availability
          WHERE provider_id = ?
          ORDER BY weekday, start_time
        `,
        args: [providerId],
      });

      return response(200, {
        availability: result.rows,
      });
    }

    let changes = [];
    let action = body.action || "";

    if (action === "replace_week") {
      const days = validateWeek(body.days);

      if (typeof days === "string") {
        return response(400, { message: days });
      }

      changes = days.map((day) => ({
        weekday: day.weekday,
        periods: day.periods,
      }));
    } else {
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

      if (action === "replace_day") {
        const periods = validatePeriods(body.periods);

        if (typeof periods === "string") {
          return response(400, { message: periods });
        }

        changes = [{ weekday, periods }];
      } else if (action === "disable") {
        changes = [{ weekday, periods: [] }];
      } else {
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

        changes = [{
          weekday,
          legacy: true,
          start_time: startTime,
          end_time: endTime,
        }];
      }
    }

    tx = await db.transaction("write");

    const today = getYemenDate();
    const weekdays = [...new Set(
      changes.map((change) => change.weekday)
    )];

    const bookings = await getFutureBookings(
      tx,
      providerId,
      weekdays,
      today
    );

    for (const change of changes) {
      const affected = bookings.filter(
        (booking) =>
          getWeekday(booking.appointment_date) === change.weekday
      );

      for (const booking of affected) {
        const fits = change.legacy
          ? (
              change.start_time <= booking.start_time &&
              change.end_time >= booking.end_time
            )
          : bookingFitsPeriods(booking, change.periods);

        if (!fits) {
          await tx.rollback();
          tx = null;

          return response(409, {
            message:
              "لا يمكن تعديل ساعات العمل؛ توجد حجوزات مستقبلية معلّقة أو مؤكدة خارج الفترات الجديدة. عالج الحجوزات أولًا.",
          });
        }
      }
    }

    for (const change of changes) {
      if (change.legacy) {
        const saved = await addLegacyPeriod(
          tx,
          providerId,
          change.weekday,
          change.start_time,
          change.end_time
        );

        if (!saved) {
          await tx.rollback();
          tx = null;

          return response(409, {
            message:
              "تتداخل هذه الفترة مع ساعات عمل محفوظة، اختر فترة أخرى",
          });
        }
      } else {
        await replaceDay(
          tx,
          providerId,
          change.weekday,
          change.periods
        );
      }
    }

    await tx.commit();
    tx = null;

    return response(200, {
      message: "تم تحديث ساعات العمل بنجاح.",
      provider_id: providerId,
    });

  } catch (error) {
    if (tx) {
      try {
        await tx.rollback();
      } catch (rollbackError) {
        console.error(
          "Availability rollback error:",
          rollbackError.message
        );
      }
    }

    console.error("Availability API error:", error.message);

    return response(500, {
      message: "تعذر حفظ ساعات العمل حاليًا",
    });
  }
};
