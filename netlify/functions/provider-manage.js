
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

const CATEGORIES_REQUIRING_IMAGES = [
  "الصالونات والجمال",
  "الحلاقة الرجالية",
  "التصوير والمناسبات",
];

const MIN_IMAGES = 3;

function validateProviderData(body) {
  const data = {
    business_name: String(body.business_name || "").trim(),
    category: String(body.category || "").trim(),
    city: String(body.city || "").trim(),
    address: String(body.address || "").trim(),
    description: String(body.description || "").trim(),
    phone: String(body.phone || "").trim(),
  };

  if (
    data.business_name.length < 2 ||
    data.business_name.length > 150 ||
    data.category.length < 2 ||
    data.category.length > 100 ||
    data.city.length < 2 ||
    data.city.length > 100 ||
    data.address.length > 250 ||
    data.description.length > 2000 ||
    !/^7[0-9]{8}$/.test(data.phone)
  ) {
    return {
      valid: false,
      message:
        "تحقق من بيانات النشاط. رقم التواصل اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7.",
    };
  }

  return { valid: true, data };
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

    const userId = Number(token.sub);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return response(401, { message: "بيانات تسجيل الدخول غير صالحة" });
    }

    const db = getDb();

    const account = await db.execute({
      sql: "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      args: [userId],
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

    // التحقق من معرّف النشاط عند التعديل أو النشر
    if (body.action === "update" || body.action === "publish") {
      const providerId = Number(body.provider_id);

      if (!Number.isSafeInteger(providerId) || providerId < 1) {
        return response(400, { message: "معرّف النشاط غير صالح" });
      }

      const ownedProvider = await db.execute({
                sql: `SELECT id, is_published, category
              FROM providers
              WHERE id = ? AND owner_user_id = ?
              LIMIT 1`,
        args: [providerId, Number(user.id)],
      });

      const provider = ownedProvider.rows[0];

      if (!provider) {
        return response(404, {
          message: "النشاط غير موجود أو لا تملكه",
        });
      }

      // تعديل بيانات النشاط
      if (body.action === "update") {
        const validation = validateProviderData(body);

        if (!validation.valid) {
          return response(400, { message: validation.message });
        }

        const data = validation.data;

        await db.execute({
          sql: `UPDATE providers
                SET business_name = ?,
                    category = ?,
                    city = ?,
                    address = ?,
                    description = ?,
                    phone = ?
                WHERE id = ? AND owner_user_id = ?`,
          args: [
            data.business_name,
            data.category,
            data.city,
            data.address || null,
            data.description || null,
            data.phone,
            providerId,
            Number(user.id),
          ],
        });

        return response(200, {
          message: "تم تحديث بيانات النشاط بنجاح",
          provider: {
            id: providerId,
            ...data,
            is_published: Number(provider.is_published),
          },
        });
      }

      // نشر نشاط موجود
      if (body.action === "publish") {
        if (Number(provider.is_published) === 1) {
          return response(200, {
            message: "النشاط منشور بالفعل",
          });
        }

        const serviceCount = await db.execute({
          sql: `SELECT COUNT(*) AS total
                FROM services
                WHERE provider_id = ? AND is_active = 1`,
          args: [providerId],
        });

        if (Number(serviceCount.rows[0]?.total || 0) < 1) {
          return response(400, {
            message: "أضف خدمة نشطة واحدة على الأقل قبل نشر النشاط",
          });
        }

                if (CATEGORIES_REQUIRING_IMAGES.includes(String(provider.category))) {
          const imageCount = await db.execute({
            sql: `SELECT COUNT(*) AS total
                  FROM provider_images
                  WHERE provider_id = ?`,
            args: [providerId],
          });

          if (Number(imageCount.rows[0]?.total || 0) < MIN_IMAGES) {
            return response(400, {
              message: `نشاطك من نوع "${provider.category}"، ارفع ${MIN_IMAGES} صور على الأقل من أعمالك قبل النشر`,
            });
          }
                }

        await db.execute({
          sql: `UPDATE providers
                SET is_published = 1
                WHERE id = ? AND owner_user_id = ?`,
          args: [providerId, Number(user.id)],
        });

        return response(200, {
          message: "تم نشر النشاط بنجاح، وأصبح متاحًا للعملاء",
          provider: {
            id: providerId,
            is_published: 1,
          },
        });
      }
    }

    // إضافة نشاط جديد
    const validation = validateProviderData(body);

    if (!validation.valid) {
      return response(400, { message: validation.message });
    }

    const data = validation.data;

    const result = await db.execute({
      sql: `INSERT INTO providers
            (owner_user_id, business_name, category, city,
             address, description, phone, is_published)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [
        Number(user.id),
        data.business_name,
        data.category,
        data.city,
        data.address || null,
        data.description || null,
        data.phone,
      ],
    });

    return response(201, {
      message: "تم تسجيل النشاط، أضف خدماته ثم انشره",
      provider: {
        id: Number(result.lastInsertRowid),
        ...data,
        is_published: 0,
      },
    });
  } catch (error) {
    console.error("Provider management error:", error.message);

    return response(500, {
      message: "تعذر تنفيذ الطلب حاليًا",
    });
  }
};
