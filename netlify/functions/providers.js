"use strict";

const { getDb } = require("../lib/db");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
    return response(405, {
      message: "طريقة الطلب غير مدعومة",
    });
  }

  try {
    const params = event.queryStringParameters || {};

    const q = String(params.q || "").trim().slice(0, 100);
    const category = String(params.category || "").trim().slice(0, 100);
    const city = String(params.city || "").trim().slice(0, 100);
    const sort = String(params.sort || "default");

    let categories = [];

    try {
      categories = params.categories
        ? JSON.parse(params.categories)
        : [];
    } catch {
      return response(400, {
        message: "قائمة التصنيفات غير صالحة",
      });
    }

    if (
      !Array.isArray(categories) ||
      categories.length > 10 ||
      categories.some(
        (item) =>
          typeof item !== "string" ||
          !item.trim() ||
          item.length > 100
      )
    ) {
      return response(400, {
        message: "قائمة التصنيفات غير صالحة",
      });
    }

    categories = [
      ...new Set(categories.map((item) => item.trim())),
    ];

    const allowedSorts = [
      "default",
      "rating",
      "popular",
      "most_reviewed",
    ];

    if (!allowedSorts.includes(sort)) {
      return response(400, {
        message: "نوع ترتيب النتائج غير صالح",
      });
    }

    const conditions = ["p.is_published = 1"];
    const args = [];

    if (q) {
      conditions.push(`(
        p.business_name LIKE ? OR
        p.category LIKE ? OR
        p.city LIKE ? OR
        p.description LIKE ? OR
        EXISTS (
          SELECT 1
          FROM services s
          WHERE s.provider_id = p.id
            AND s.is_active = 1
            AND s.name LIKE ?
        )
      )`);

      const term = `%${q}%`;
      args.push(term, term, term, term, term);
    }

    if (categories.length) {
      conditions.push(
        `p.category IN (${categories.map(() => "?").join(", ")})`
      );
      args.push(...categories);
    } else if (category) {
      conditions.push("p.category = ?");
      args.push(category);
    }

    if (city) {
      conditions.push("p.city LIKE ?");
      args.push(`%${city}%`);
    }

    let orderBy = "p.business_name COLLATE NOCASE ASC";

    if (sort === "rating") {
      orderBy =
        "average_rating DESC, review_count DESC, p.business_name COLLATE NOCASE ASC";
    } else if (sort === "popular") {
      orderBy =
        "booking_count DESC, average_rating DESC, p.business_name COLLATE NOCASE ASC";
    } else if (sort === "most_reviewed") {
      orderBy =
        "review_count DESC, average_rating DESC, p.business_name COLLATE NOCASE ASC";
    }

    const db = getDb();

    const result = await db.execute({
      sql: `
        WITH service_data AS (
          SELECT
            provider_id,
            GROUP_CONCAT(name, '، ') AS services
          FROM services
          WHERE is_active = 1
          GROUP BY provider_id
        ),
        review_data AS (
          SELECT
            provider_id,
            ROUND(AVG(rating), 1) AS average_rating,
            COUNT(*) AS review_count
          FROM reviews
          GROUP BY provider_id
        ),
        booking_data AS (
          SELECT
            provider_id,
            COUNT(*) AS booking_count
          FROM bookings
          WHERE status IN ('confirmed', 'completed')
          GROUP BY provider_id
        )
        SELECT
          p.id,
          p.business_name,
          p.category,
          p.city,
          p.address,
          p.description,
          p.phone,
          p.image_url,
          p.created_at,
          COALESCE(sd.services, '') AS services,
          COALESCE(rd.average_rating, 0) AS average_rating,
          COALESCE(rd.review_count, 0) AS review_count,
          COALESCE(bd.booking_count, 0) AS booking_count
        FROM providers p
        LEFT JOIN service_data sd ON sd.provider_id = p.id
        LEFT JOIN review_data rd ON rd.provider_id = p.id
        LEFT JOIN booking_data bd ON bd.provider_id = p.id
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${orderBy}
        LIMIT 50
      `,
      args,
    });

    const providers = result.rows.map((row) => ({
      id: Number(row.id),
      business_name: row.business_name,
      category: row.category,
      city: row.city,
      address: row.address,
      description: row.description,
      phone: row.phone,
      image_url: row.image_url,
      services: row.services || "",
      created_at: row.created_at,
      average_rating: Number(row.average_rating || 0),
      review_count: Number(row.review_count || 0),
      booking_count: Number(row.booking_count || 0),
    }));

    return response(200, {
      providers,
      count: providers.length,
    });
  } catch (error) {
    console.error("Providers API error:", error.message);

    return response(500, {
      message: "تعذر البحث عن الأنشطة حاليًا",
    });
  }
};
