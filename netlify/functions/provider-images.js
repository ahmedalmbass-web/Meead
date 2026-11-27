"use strict";

const crypto = require("crypto");
const { connectLambda, getStore } = require("@netlify/blobs");
const { getDb } = require("../lib/db");
const { verifyToken } = require("../lib/auth");

const MAX_IMAGES = 12;
const MAX_BYTES = 4 * 1024 * 1024; // الحجم بعد فك التشفير
const API_PATH = "/.netlify/functions/provider-images";

// العمود الذي يربط النشاط بحساب صاحبه
const OWNER_COLUMN = "owner_user_id";

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const jsonHeaders = {
  ...baseHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(statusCode, data) {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(data) };
}

function detectType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return "image/png";
  }
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function imageUrl(id) {
  return `${API_PATH}?image=${id}`;
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

let tableEnsured = false;
async function ensureTable(db) {
  if (tableEnsured) return;
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS provider_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        blob_key TEXT,
        content_type TEXT NOT NULL,
        image_data TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // التأكد من وجود عمود image_data في حال كان الجدول منشأ سابقاً بدونه
    await db.execute("ALTER TABLE provider_images ADD COLUMN image_data TEXT;").catch(() => {});
    tableEnsured = true;
  } catch (err) {
    console.warn("ensureTable error (non-fatal):", err.message);
  }
}

function getSafeStore(event) {
  try {
    connectLambda(event);
    return getStore("provider-images");
  } catch (err) {
    console.warn("Netlify Blobs init failed (using database fallback):", err.message);
    return null;
  }
}

// يرجع النشاط إذا كان المستخدم الحالي هو صاحبه، وإلا null
async function getOwnedProvider(db, providerId, token) {
  if (!token) return null;
  const userId = toPositiveInt(token.sub);
  if (!userId) return null;

  const result = await db.execute({
    sql: `SELECT id, image_url, is_published
          FROM providers
          WHERE id = ? AND ${OWNER_COLUMN} = ?
          LIMIT 1`,
    args: [providerId, userId],
  });

  return result.rows[0] || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: baseHeaders, body: "" };
  }

  try {
    const db = getDb();
    await ensureTable(db);
    const store = getSafeStore(event);
    const params = event.queryStringParameters || {};

    // ───────── عرض صورة واحدة ─────────
    if (event.httpMethod === "GET" && params.image) {
      const imageId = toPositiveInt(params.image);
      if (!imageId) return json(400, { message: "رقم الصورة غير صالح" });

      const row = (
        await db.execute({
          sql: "SELECT blob_key, content_type, image_data FROM provider_images WHERE id = ? LIMIT 1",
          args: [imageId],
        })
      ).rows[0];

      if (!row) return json(404, { message: "الصورة غير موجودة" });

      let imageBuffer = null;

      // 1. محاولة جلب الصورة من Netlify Blobs أولاً
      if (store && row.blob_key) {
        try {
          const data = await store.get(String(row.blob_key), { type: "arrayBuffer" });
          if (data) {
            imageBuffer = Buffer.from(data);
          }
        } catch (blobErr) {
          console.warn("Blobs store get failed, falling back to image_data:", blobErr.message);
        }
      }

      // 2. استخدام التخزين الاحتياطي المباشر من قاعدة البيانات (image_data base64)
      if (!imageBuffer && row.image_data) {
        try {
          imageBuffer = Buffer.from(String(row.image_data), "base64");
        } catch (bufErr) {
          console.warn("Failed to decode image_data base64:", bufErr.message);
        }
      }

      if (!imageBuffer) {
        return json(404, { message: "الصورة غير موجودة" });
      }

      return {
        statusCode: 200,
        headers: {
          ...baseHeaders,
          "Content-Type": String(row.content_type || "image/jpeg"),
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
        body: imageBuffer.toString("base64"),
        isBase64Encoded: true,
      };
    }

    // ───────── قائمة صور نشاط ─────────
    if (event.httpMethod === "GET") {
      const providerId = toPositiveInt(params.provider_id);
      if (!providerId) return json(400, { message: "رقم النشاط غير صالح" });

      const provider = (
        await db.execute({
          sql: "SELECT id, is_published, image_url FROM providers WHERE id = ? LIMIT 1",
          args: [providerId],
        })
      ).rows[0];

      if (!provider) return json(404, { message: "النشاط غير موجود" });

      // النشاط غير المنشور يراه صاحبه فقط
      if (!Number(provider.is_published)) {
        const owned = await getOwnedProvider(db, providerId, verifyToken(event));
        if (!owned) return json(404, { message: "النشاط غير موجود" });
      }

      const rows = (
        await db.execute({
          sql: `SELECT id, content_type, sort_order FROM provider_images
                WHERE provider_id = ?
                ORDER BY sort_order ASC, id ASC`,
          args: [providerId],
        })
      ).rows;

      return json(200, {
        images: rows.map((r, idx) => ({
          id: Number(r.id),
          url: imageUrl(r.id),
          is_cover: provider.image_url === imageUrl(r.id) || (!provider.image_url && idx === 0),
        })),
        count: rows.length,
      });
    }

    // ───────── من هنا فصاعدًا: يلزم تسجيل الدخول ─────────
    const token = verifyToken(event);
    if (!token) return json(401, { message: "سجّل الدخول أولًا" });

    // ───────── رفع صورة ─────────
    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { message: "بيانات الطلب غير صالحة" });
      }

      const providerId = toPositiveInt(body.provider_id);
      if (!providerId || typeof body.image_base64 !== "string") {
        return json(400, { message: "بيانات الصورة ناقصة" });
      }

      const provider = await getOwnedProvider(db, providerId, token);
      if (!provider) {
        return json(403, { message: "لا تملك صلاحية على هذا النشاط" });
      }

      const countRow = (
        await db.execute({
          sql: "SELECT COUNT(*) AS c FROM provider_images WHERE provider_id = ?",
          args: [providerId],
        })
      ).rows[0];

      if (Number(countRow.c) >= MAX_IMAGES) {
        return json(409, { message: `الحد الأقصى ${MAX_IMAGES} صورة لكل نشاط` });
      }

      const buf = Buffer.from(body.image_base64, "base64");
      if (!buf.length || buf.length > MAX_BYTES) {
        return json(400, { message: "حجم الصورة غير مقبول (الحد 4 ميجا)" });
      }

      const contentType = detectType(buf);
      if (!contentType) {
        return json(400, { message: "الصيغة المسموحة: JPG أو PNG أو WebP" });
      }

      let blobKey = crypto.randomUUID();
      let blobStored = false;

      // محاولة الحفظ في Netlify Blobs إذا كان متاحاً
      if (store) {
        try {
          const arrayBuffer = buf.buffer.slice(
            buf.byteOffset,
            buf.byteOffset + buf.byteLength
          );
          await store.set(blobKey, arrayBuffer);
          blobStored = true;
        } catch (blobErr) {
          console.warn("Netlify Blobs store.set failed, using DB image_data fallback:", blobErr.message);
          blobKey = null;
        }
      } else {
        blobKey = null;
      }

      let insertedId;
      try {
        // الحفظ المزدوج: حفظ المفتاح ونسخة base64 في image_data للضمان التام 100%
        const inserted = await db.execute({
          sql: `INSERT INTO provider_images
                  (provider_id, blob_key, content_type, image_data, sort_order)
                VALUES (?, ?, ?, ?, ?)`,
          args: [providerId, blobKey, contentType, body.image_base64, Number(countRow.c)],
        });
        insertedId = Number(inserted.lastInsertRowid);
      } catch (error) {
        if (blobStored && store && blobKey) {
          await store.delete(blobKey).catch(() => {});
        }
        throw error;
      }

      // التعيين التلقائي لصورة الغلاف عند أول رفع
      const currentCover = provider.image_url ? String(provider.image_url).trim() : "";
      if (!currentCover || Number(countRow.c) === 0) {
        await db.execute({
          sql: "UPDATE providers SET image_url = ? WHERE id = ?",
          args: [imageUrl(insertedId), providerId],
        });
      }

      return json(201, {
        message: "تم رفع الصورة بنجاح",
        image: { id: insertedId, url: imageUrl(insertedId), is_cover: !currentCover || Number(countRow.c) === 0 },
      });
    }

    // ───────── حذف صورة ─────────
    if (event.httpMethod === "DELETE") {
      const imageId = toPositiveInt(params.image);
      if (!imageId) return json(400, { message: "رقم الصورة غير صالح" });

      const row = (
        await db.execute({
          sql: `SELECT i.id, i.provider_id, i.blob_key
                FROM provider_images i
                JOIN providers p ON p.id = i.provider_id
                WHERE i.id = ? AND p.${OWNER_COLUMN} = ?
                LIMIT 1`,
          args: [imageId, Number(token.sub)],
        })
      ).rows[0];

      if (!row) return json(404, { message: "الصورة غير موجودة" });

      await db.execute({
        sql: "DELETE FROM provider_images WHERE id = ?",
        args: [imageId],
      });

      if (store && row.blob_key) {
        await store.delete(String(row.blob_key)).catch(() => {});
      }

      // إذا كانت هي الغلاف، نستبدلها بأول صورة متبقية (أو نفرّغ الغلاف)
      const providerId = Number(row.provider_id);
      const cover = (
        await db.execute({
          sql: "SELECT image_url FROM providers WHERE id = ? LIMIT 1",
          args: [providerId],
        })
      ).rows[0];

      if (cover && cover.image_url === imageUrl(imageId)) {
        const next = (
          await db.execute({
            sql: `SELECT id FROM provider_images
                  WHERE provider_id = ?
                  ORDER BY sort_order ASC, id ASC LIMIT 1`,
            args: [providerId],
          })
        ).rows[0];

        await db.execute({
          sql: "UPDATE providers SET image_url = ? WHERE id = ?",
          args: [next ? imageUrl(next.id) : null, providerId],
        });
      }

      return json(200, { message: "تم حذف الصورة" });
    }

    return json(405, { message: "طريقة الطلب غير مدعومة" });
  } catch (error) {
    console.error("Provider images API error:", error.message);
    return json(500, { message: "تعذر تنفيذ العملية حاليًا" });
  }
};
