
const { getDb } = require("../lib/db");
const { verifyToken } = require("../lib/auth");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (event.httpMethod !== "GET") {
    return response(405, { message: "طريقة الطلب غير مدعومة" });
  }

  const token = verifyToken(event);

  if (
  !token ||
  !Number.isSafeInteger(Number(token.sub)) ||
  Number(token.sub) <= 0
) {
    return response(401, { message: "سجّل الدخول مجددًا" });
  }

  try {
    const db = getDb();

    // التحقق من صلاحية المدير من قاعدة البيانات.
    const account = await db.execute({
      sql: "SELECT role FROM users WHERE id = ? LIMIT 1",
      args: [Number(token.sub)],
    });

    if (!account.rows[0] || account.rows[0].role !== "admin") {
      return response(403, {
        message: "ليس لديك صلاحية إدارة الأنشطة التجارية",
      });
    }

    const result = await db.execute({
      sql: `SELECT
              p.id,
              p.owner_user_id,
              p.business_name,
              p.category,
              p.city,
              p.address,
              p.description,
              p.phone,
              p.image_url,
              p.is_published,
              p.created_at,
              u.name AS owner_name,
              u.email AS owner_email
            FROM providers p
            LEFT JOIN users u ON u.id = p.owner_user_id
            ORDER BY p.id DESC
            LIMIT 200`,
      args: [],
    });

    return response(200, {
      providers: result.rows.map((row) => ({
        ...row,
        id: Number(row.id),
        owner_user_id: Number(row.owner_user_id),
        is_published: Number(row.is_published),
      })),
    });
  } catch (error) {
    console.error("Admin providers error:", error.message);

    return response(500, {
      message: "تعذر تحميل الأنشطة التجارية حاليًا",
    });
  }
};
