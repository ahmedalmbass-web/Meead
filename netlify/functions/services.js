
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

  try {
    const db = getDb();
    const params = event.queryStringParameters || {};

    if (event.httpMethod === "GET") {
      const providerId = Number(params.providerId);

      if (!Number.isSafeInteger(providerId) || providerId < 1) {
        return response(400, { message: "معرّف النشاط غير صالح" });
      }

      const result = await db.execute({
        sql: `SELECT s.id, s.provider_id, s.name, s.description,
                     s.duration_minutes, s.price, s.currency
              FROM services s
              JOIN providers p ON p.id = s.provider_id
              WHERE s.provider_id = ?
                AND s.is_active = 1
                AND p.is_published = 1
              ORDER BY s.name COLLATE NOCASE`,
        args: [providerId],
      });

      return response(200, {
        services: result.rows.map((row) => ({
          ...row,
          id: Number(row.id),
          provider_id: Number(row.provider_id),
          duration_minutes: Number(row.duration_minutes),
          price: Number(row.price),
        })),
      });
    }

    const token = verifyToken(event);

    if (!token) {
      return response(401, { message: "سجّل الدخول أولًا" });
    }

    const body = JSON.parse(event.body || "{}");
    const providerId = Number(body.provider_id);
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const duration = Number(body.duration_minutes);
    const price = Number(body.price);
    const currency = String(body.currency || "YER").toUpperCase();

    if (
      !Number.isSafeInteger(providerId) || providerId < 1 ||
      name.length < 2 || name.length > 150 ||
      description.length > 1000 ||
      !Number.isInteger(duration) || duration < 5 || duration > 1440 ||
      !Number.isFinite(price) || price < 0 || price > 1000000000 ||
      !["YER", "SAR", "USD"].includes(currency)
    ) {
      return response(400, { message: "تحقق من بيانات الخدمة وسعرها ومدتها" });
    }

    const account = await db.execute({
      sql: "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      args: [Number(token.sub)],
    });

    if (!account.rows[0] || account.rows[0].role !== "provider") {
      return response(403, { message: "يلزم حساب مقدم خدمات" });
    }

    const ownedProvider = await db.execute({
      sql: "SELECT id FROM providers WHERE id = ? AND owner_user_id = ?",
      args: [providerId, Number(token.sub)],
    });

    if (!ownedProvider.rows.length) {
      return response(403, { message: "لا تملك صلاحية إدارة هذا النشاط" });
    }

    const result = await db.execute({
      sql: `INSERT INTO services
            (provider_id, name, description, duration_minutes, price, currency)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        providerId,
        name,
        description || null,
        duration,
        price,
        currency,
      ],
    });

    return response(201, {
      message: "تمت إضافة الخدمة",
      service: {
        id: Number(result.lastInsertRowid),
        provider_id: providerId,
        name,
        description: description || null,
        duration_minutes: duration,
        price,
        currency,
      },
    });
  } catch (error) {
    console.error("Services API error:", error.message);

    if (event.httpMethod === "POST" && error instanceof SyntaxError) {
      return response(400, { message: "بيانات الطلب غير صالحة" });
    }

    return response(500, { message: "تعذر تنفيذ الطلب حاليًا" });
  }
};
