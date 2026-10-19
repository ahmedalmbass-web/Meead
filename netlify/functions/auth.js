
const { getDb } = require("../lib/db");
const {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
} = require("../lib/auth");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  const action = event.queryStringParameters?.action;
  const db = getDb();

  try {
    if (event.httpMethod === "POST" && action === "register") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { message: "بيانات الطلب غير صالحة" });
      }

      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = body.password;
      const phone = String(body.phone || "").trim();
      const role = body.role === "provider" ? "provider" : "customer";

            if (
        name.length < 2 ||
        name.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 72 ||
        !/^7[0-9]{8}$/.test(phone)
      ) {
        return response(400, {
          message:
            "تحقق من الاسم والبريد وكلمة المرور. رقم الهاتف اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7.",
        });
            }

      const existing = await db.execute({
        sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
        args: [email],
      });

      if (existing.rows.length) {
        return response(409, { message: "البريد الإلكتروني مسجل مسبقًا" });
      }

      const passwordHash = await hashPassword(password);

      const result = await db.execute({
        sql: `INSERT INTO users (name, email, password_hash, phone, role)
              VALUES (?, ?, ?, ?, ?)`,
        args: [name, email, passwordHash, phone || null, role],
      });

      const user = {
        id: Number(result.lastInsertRowid),
        name,
        email,
        phone: phone || null,
        role,
      };

      return response(201, {
        message: "تم إنشاء الحساب بنجاح",
        user,
        token: createToken(user),
      });
    }

    if (event.httpMethod === "POST" && action === "login") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { message: "بيانات الطلب غير صالحة" });
      }

      const email = String(body.email || "").trim().toLowerCase();
      const password = body.password;

      if (
        !email ||
        typeof password !== "string" ||
        password.length > 72
      ) {
        return response(400, { message: "أدخل البريد وكلمة المرور" });
      }

      const result = await db.execute({
        sql: `SELECT id, name, email, password_hash, phone, role
              FROM users WHERE email = ? LIMIT 1`,
        args: [email],
      });

      const row = result.rows[0];

      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return response(401, {
          message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        });
      }

      const user = {
        id: Number(row.id),
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
      };

      return response(200, {
        message: "تم تسجيل الدخول بنجاح",
        user,
        token: createToken(user),
      });
    }

    if (event.httpMethod === "GET" && action === "me") {
      const payload = verifyToken(event);

      if (
  !payload ||
  !Number.isSafeInteger(Number(payload.sub)) ||
  Number(payload.sub) <= 0
) {
  return response(401, { message: "يلزم تسجيل الدخول مجددًا" });
      }

      const result = await db.execute({
        sql: `SELECT id, name, email, phone, role
              FROM users WHERE id = ? LIMIT 1`,
        args: [Number(payload.sub)],
      });

      const row = result.rows[0];

      if (!row) {
        return response(401, { message: "الحساب غير موجود" });
      }

      return response(200, {
        user: {
          id: Number(row.id),
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: row.role,
        },
      });
    }

    return response(404, {
      message: "المسار غير معروف",
      usage: [
        "POST ?action=register",
        "POST ?action=login",
        "GET ?action=me",
      ],
    });
  } catch (error) {
    console.error("Auth API error:", error.message);

    return response(500, {
      message: "حدث خطأ في الخادم، حاول لاحقًا",
    });
  }
};
