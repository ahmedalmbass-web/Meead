

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
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function validServiceData(body) {
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const duration = Number(body.duration_minutes);
  const price = Number(body.price);
  const currency = String(body.currency || "YER").toUpperCase();

  if (
    name.length < 2 ||
    name.length > 150 ||
    description.length > 1000 ||
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 1440 ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 1000000000 ||
    !["YER", "SAR", "USD"].includes(currency)
  ) {
    return {
      error: "تحقق من اسم الخدمة ووصفها ومدتها وسعرها وعملتها.",
    };
  }

  return {
    name,
    description: description || null,
    duration,
    price,
    currency,
  };
}

async function getProviderAccount(executor, userId, providerId) {
  const account = await executor.execute({
    sql: "SELECT id, role FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });

  if (!account.rows[0] || account.rows[0].role !== "provider") {
    return false;
  }

  const ownedProvider = await executor.execute({
    sql: `SELECT id FROM providers
          WHERE id = ? AND owner_user_id = ?
          LIMIT 1`,
    args: [providerId, userId],
  });

  return ownedProvider.rows.length > 0;
}

function formatService(row) {
  return {
    id: Number(row.id),
    provider_id: Number(row.provider_id),
    name: row.name,
    description: row.description || "",
    duration_minutes: Number(row.duration_minutes),
    price: Number(row.price),
    currency: row.currency,
    is_active: Number(row.is_active),
  };
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

  let tx = null;

  try {
    const db = getDb();
    const params = event.queryStringParameters || {};

    // GET: عرض الخدمات
    if (event.httpMethod === "GET") {
      const providerId = Number(params.providerId);

      if (!Number.isSafeInteger(providerId) || providerId < 1) {
        return response(400, {
          message: "معرّف النشاط غير صالح",
        });
      }

      if (params.manage === "1") {
        const token = verifyToken(event);

        if (!token) {
          return response(401, {
            message: "سجّل الدخول أولًا",
          });
        }

        const userId = Number(token.sub);

        if (!Number.isSafeInteger(userId) || userId < 1) {
          return response(401, {
            message: "بيانات تسجيل الدخول غير صالحة",
          });
        }

        const allowed = await getProviderAccount(
          db,
          userId,
          providerId
        );

        if (!allowed) {
          return response(403, {
            message: "لا تملك صلاحية إدارة خدمات هذا النشاط",
          });
        }

        const result = await db.execute({
          sql: `SELECT id, provider_id, name, description,
                       duration_minutes, price, currency, is_active
                FROM services
                WHERE provider_id = ?
                ORDER BY created_at DESC, id DESC`,
          args: [providerId],
        });

        return response(200, {
          services: result.rows.map(formatService),
        });
      }

      const result = await db.execute({
        sql: `SELECT s.id, s.provider_id, s.name, s.description,
                     s.duration_minutes, s.price, s.currency,
                     s.is_active
              FROM services s
              JOIN providers p ON p.id = s.provider_id
              WHERE s.provider_id = ?
                AND s.is_active = 1
                AND p.is_published = 1
              ORDER BY s.name COLLATE NOCASE`,
        args: [providerId],
      });

      return response(200, {
        services: result.rows.map(formatService),
      });
    }

    // POST: إدارة الخدمات
    const token = verifyToken(event);

    if (!token) {
      return response(401, {
        message: "سجّل الدخول أولًا",
      });
    }

    const userId = Number(token.sub);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return response(401, {
        message: "بيانات تسجيل الدخول غير صالحة",
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

    const action = String(body.action || "create");
    const providerId = Number(body.provider_id);

    if (!Number.isSafeInteger(providerId) || providerId < 1) {
      return response(400, {
        message: "معرّف النشاط غير صالح",
      });
    }

    tx = await db.transaction("write");

    const allowed = await getProviderAccount(
      tx,
      userId,
      providerId
    );

    if (!allowed) {
      await tx.rollback();
      tx = null;

      return response(403, {
        message: "لا تملك صلاحية إدارة هذا النشاط",
      });
    }

    // تغيير حالة الخدمة
    if (action === "set_status") {
      const serviceId = Number(body.service_id);
      const isActive = Number(body.is_active);

      if (
        !Number.isSafeInteger(serviceId) ||
        serviceId < 1 ||
        ![0, 1].includes(isActive)
      ) {
        await tx.rollback();
        tx = null;

        return response(400, {
          message: "بيانات حالة الخدمة غير صالحة",
        });
      }

      const serviceResult = await tx.execute({
        sql: `SELECT id, is_active
              FROM services
              WHERE id = ? AND provider_id = ?
              LIMIT 1`,
        args: [serviceId, providerId],
      });

      if (!serviceResult.rows.length) {
        await tx.rollback();
        tx = null;

        return response(404, {
          message: "الخدمة غير موجودة في هذا النشاط",
        });
      }

      if (isActive === 0) {
        const bookings = await tx.execute({
          sql: `SELECT id
                FROM bookings
                WHERE service_id = ?
                  AND appointment_date >= ?
                  AND status IN ('pending', 'confirmed')
                LIMIT 1`,
          args: [serviceId, getYemenDate()],
        });

        if (bookings.rows.length) {
          await tx.rollback();
          tx = null;

          return response(409, {
            message:
              "لا يمكن تعطيل الخدمة؛ توجد حجوزات مستقبلية معلّقة أو مؤكدة. عالج الحجوزات أولًا.",
          });
        }
      }

      await tx.execute({
        sql: `UPDATE services
              SET is_active = ?
              WHERE id = ? AND provider_id = ?`,
        args: [isActive, serviceId, providerId],
      });

      await tx.commit();
      tx = null;

      return response(200, {
        message: isActive
          ? "تم تفعيل الخدمة"
          : "تم تعطيل الخدمة",
      });
    }

    // إضافة أو تعديل بيانات الخدمة
    if (action === "create" || action === "update") {
      const serviceData = validServiceData(body);

      if (serviceData.error) {
        await tx.rollback();
        tx = null;

        return response(400, {
          message: serviceData.error,
        });
      }

      if (action === "update") {
        const serviceId = Number(body.service_id);

        if (
          !Number.isSafeInteger(serviceId) ||
          serviceId < 1
        ) {
          await tx.rollback();
          tx = null;

          return response(400, {
            message: "معرّف الخدمة غير صالح",
          });
        }

        const existingResult = await tx.execute({
          sql: `SELECT id, duration_minutes, is_active
                FROM services
                WHERE id = ? AND provider_id = ?
                LIMIT 1`,
          args: [serviceId, providerId],
        });

        const existing = existingResult.rows[0];

        if (!existing) {
          await tx.rollback();
          tx = null;

          return response(404, {
            message: "الخدمة غير موجودة في هذا النشاط",
          });
        }

        const durationChanged =
          Number(existing.duration_minutes) !== serviceData.duration;

        if (durationChanged) {
          const bookings = await tx.execute({
            sql: `SELECT id
                  FROM bookings
                  WHERE service_id = ?
                    AND appointment_date >= ?
                    AND status IN ('pending', 'confirmed')
                  LIMIT 1`,
            args: [serviceId, getYemenDate()],
          });

          if (bookings.rows.length) {
            await tx.rollback();
            tx = null;

            return response(409, {
              message:
                "لا يمكن تغيير مدة الخدمة؛ توجد حجوزات مستقبلية معلّقة أو مؤكدة. عالج الحجوزات أولًا.",
            });
          }
        }

        await tx.execute({
          sql: `UPDATE services
                SET name = ?,
                    description = ?,
                    duration_minutes = ?,
                    price = ?,
                    currency = ?
                WHERE id = ? AND provider_id = ?`,
          args: [
            serviceData.name,
            serviceData.description,
            serviceData.duration,
            serviceData.price,
            serviceData.currency,
            serviceId,
            providerId,
          ],
        });

        await tx.commit();
        tx = null;

        return response(200, {
          message: "تم تحديث بيانات الخدمة بنجاح",
          service: {
            id: serviceId,
            provider_id: providerId,
            name: serviceData.name,
            description: serviceData.description || "",
            duration_minutes: serviceData.duration,
            price: serviceData.price,
            currency: serviceData.currency,
            is_active: Number(existing.is_active),
          },
        });
      }

      const result = await tx.execute({
        sql: `INSERT INTO services
              (provider_id, name, description,
               duration_minutes, price, currency)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          providerId,
          serviceData.name,
          serviceData.description,
          serviceData.duration,
          serviceData.price,
          serviceData.currency,
        ],
      });

      await tx.commit();
      tx = null;

      return response(201, {
        message: "تمت إضافة الخدمة بنجاح",
        service: {
          id: Number(result.lastInsertRowid),
          provider_id: providerId,
          name: serviceData.name,
          description: serviceData.description || "",
          duration_minutes: serviceData.duration,
          price: serviceData.price,
          currency: serviceData.currency,
          is_active: 1,
        },
      });
    }

    await tx.rollback();
    tx = null;

    return response(400, {
      message: "العملية المطلوبة غير معروفة",
    });

  } catch (error) {
    if (tx) {
      try {
        await tx.rollback();
      } catch (rollbackError) {
        console.error(
          "Services rollback error:",
          rollbackError.message
        );
      }
    }

    console.error("Services API error:", error.message);

    return response(500, {
      message: "تعذر تنفيذ الطلب حاليًا",
    });
  }
};
