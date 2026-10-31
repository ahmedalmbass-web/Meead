
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

async function getProviderAccount(db, token, providerId) {
  const userId = Number(token.sub);

  if (!Number.isSafeInteger(userId) || userId < 1) {
    return false;
  }

  const account = await db.execute({
    sql: "SELECT id, role FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });

  if (!account.rows[0] || account.rows[0].role !== "provider") {
    return false;
  }

  const ownedProvider = await db.execute({
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

  try {
    const db = getDb();
    const params = event.queryStringParameters || {};

    // ==========================================
    // GET: عرض خدمات العملاء أو خدمات مقدم النشاط
    // ==========================================

    if (event.httpMethod === "GET") {
      const providerId = Number(params.providerId);

      if (!Number.isSafeInteger(providerId) || providerId < 1) {
        return response(400, {
          message: "معرّف النشاط غير صالح",
        });
      }

      // عرض الإدارة يتطلب تسجيل الدخول والتحقق من الملكية.
      if (params.manage === "1") {
        const token = verifyToken(event);

        if (!token) {
          return response(401, {
            message: "سجّل الدخول أولًا",
          });
        }

        const allowed = await getProviderAccount(
          db,
          token,
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

      // العرض العام للعملاء: الخدمات النشطة للنشاط المنشور فقط.
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

    // ==========================================
    // POST: إضافة أو تعديل أو تفعيل أو تعطيل خدمة
    // ==========================================

    const token = verifyToken(event);

    if (!token) {
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

    const action = String(body.action || "create");
    const providerId = Number(body.provider_id);

    if (!Number.isSafeInteger(providerId) || providerId < 1) {
      return response(400, {
        message: "معرّف النشاط غير صالح",
      });
    }

    const allowed = await getProviderAccount(
      db,
      token,
      providerId
    );

    if (!allowed) {
      return response(403, {
        message: "لا تملك صلاحية إدارة هذا النشاط",
      });
    }

    // ==========================================
    // تعديل حالة الخدمة
    // ==========================================

    if (action === "set_status") {
      const serviceId = Number(body.service_id);
      const isActive = Number(body.is_active);

      if (
        !Number.isSafeInteger(serviceId) ||
        serviceId < 1 ||
        ![0, 1].includes(isActive)
      ) {
        return response(400, {
          message: "بيانات حالة الخدمة غير صالحة",
        });
      }

      const result = await db.execute({
        sql: `UPDATE services
              SET is_active = ?
              WHERE id = ? AND provider_id = ?`,
        args: [isActive, serviceId, providerId],
      });

      if (Number(result.rowsAffected) === 0) {
        return response(404, {
          message: "الخدمة غير موجودة في هذا النشاط",
        });
      }

      return response(200, {
        message: isActive
          ? "تم تفعيل الخدمة"
          : "تم تعطيل الخدمة",
      });
    }

    // ==========================================
    // إضافة أو تعديل بيانات الخدمة
    // ==========================================

    if (action === "create" || action === "update") {
      const serviceData = validServiceData(body);

      if (serviceData.error) {
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
          return response(400, {
            message: "معرّف الخدمة غير صالح",
          });
        }

        const result = await db.execute({
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

        if (Number(result.rowsAffected) === 0) {
          return response(404, {
            message: "الخدمة غير موجودة في هذا النشاط",
          });
        }

        return response(200, {
          message: "تم تحديث بيانات الخدمة بنجاح",
          service: {
            id: serviceId,
            provider_id: providerId,
            ...serviceData,
            is_active: 1,
          },
        });
      }

      const result = await db.execute({
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

      return response(201, {
        message: "تمت إضافة الخدمة بنجاح",
        service: {
          id: Number(result.lastInsertRowid),
          provider_id: providerId,
          ...serviceData,
          is_active: 1,
        },
      });
    }

    return response(400, {
      message: "العملية المطلوبة غير معروفة",
    });
  } catch (error) {
    console.error("Services API error:", error.message);

    return response(500, {
      message: "تعذر تنفيذ الطلب حاليًا",
    });
  }
};
