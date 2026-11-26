
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

    // التحقق من دور الحساب الحالي مباشرة من قاعدة البيانات.
    const account = await db.execute({
      sql: "SELECT role FROM users WHERE id = ? LIMIT 1",
      args: [Number(token.sub)],
    });

    if (!account.rows[0] || account.rows[0].role !== "admin") {
      return response(403, {
        message: "ليس لديك صلاحية للوصول إلى إدارة المستخدمين",
      });
    }

    const result = await db.execute({
      sql: `SELECT id, name, email, phone, role
            FROM users
            ORDER BY id DESC
            LIMIT 200`,
      args: [],
    });

    return response(200, {
      users: result.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
      })),
    });
  } catch (error) {
    console.error("Admin users error:", error.message);

    return response(500, {
      message: "تعذر تحميل المستخدمين حاليًا",
    });
  }
};
