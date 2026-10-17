
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
    const token = verifyToken(event);

    if (!token) {
      return response(401, { message: "سجّل الدخول أولًا" });
    }

    const db = getDb();

    const account = await db.execute({
      sql: "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      args: [Number(token.sub)],
    });

    const user = account.rows[0];

    if (!user || user.role !== "provider") {
      return response(403, {
        message: "يجب تسجيل الدخول بحساب مقدم خدمات",
      });
    }

    if (event.httpMethod === "GET") {
      const result = await db.execute({
        sql: `SELECT id, business_name, category, city, address,
                     description, phone, image_url, is_published
              FROM providers
              WHERE owner_user_id = ?
              ORDER BY id DESC`,
        args: [Number(user.id)],
      });

      return response(200, {
        providers: result.rows.map((row) => ({
          ...row,
          id: Number(row.id),
          owner_user_id: Number(user.id),
          is_published: Number(row.is_published),
        })),
      });
    }

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { message: "بيانات الطلب غير صالحة" });
    }

    const businessName = String(body.business_name || "").trim();
    const category = String(body.category || "").trim();
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim();
    const description = String(body.description || "").trim();
    const phone = String(body.phone || "").trim();

    if (
      businessName.length < 2 || businessName.length > 150 ||
      category.length < 2 || category.length > 100 ||
      city.length < 2 || city.length > 100 ||
      address.length > 250 ||
      description.length > 2000 ||
      phone.length > 30
    ) {
      return response(400, {
        message: "تحقق من اسم النشاط والتصنيف والمدينة وبقية البيانات",
      });
    }

    const result = await db.execute({
      sql: `INSERT INTO providers
            (owner_user_id, business_name, category, city,
             address, description, phone, is_published)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [
        Number(user.id),
        businessName,
        category,
        city,
        address || null,
        description || null,
        phone || null,
      ],
    });

    return response(201, {
      message: "تم تسجيل النشاط، وهو غير منشور حتى استكمال إعداده",
      provider: {
        id: Number(result.lastInsertRowid),
        business_name: businessName,
        category,
        city,
        is_published: 0,
      },
    });
  } catch (error) {
    console.error("Provider management error:", error.message);
    return response(500, { message: "تعذر تنفيذ الطلب حاليًا" });
  }
};
