
const { getDb } = require("../lib/db");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
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
    return response(405, { message: "طريقة الطلب غير مدعومة" });
  }

  try {
    const params = event.queryStringParameters || {};
    const q = String(params.q || "").trim().slice(0, 100);
    const category = String(params.category || "").trim().slice(0, 100);
    const city = String(params.city || "").trim().slice(0, 100);

    const conditions = ["p.is_published = 1"];
    const args = [];

    if (q) {
      conditions.push(`(
        p.business_name LIKE ? OR
        p.category LIKE ? OR
        p.city LIKE ? OR
        p.description LIKE ? OR
        EXISTS (
          SELECT 1 FROM services s
          WHERE s.provider_id = p.id
            AND s.is_active = 1
            AND s.name LIKE ?
        )
      )`);

      const term = `%${q}%`;
      args.push(term, term, term, term, term);
    }

    if (category) {
      conditions.push("p.category = ?");
      args.push(category);
    }

    if (city) {
      conditions.push("p.city LIKE ?");
      args.push(`%${city}%`);
    }

    const db = getDb();

    const result = await db.execute({
      sql: `
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
(
  SELECT GROUP_CONCAT(s.name, '، ')
  FROM services s
  WHERE s.provider_id = p.id
    AND s.is_active = 1
) AS services
        FROM providers p
        WHERE ${conditions.join(" AND ")}
        ORDER BY p.business_name COLLATE NOCASE
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
    }));

    return response(200, {
      providers,
      count: providers.length,
    });
  } catch (error) {
    console.error("Providers API error:", error.message);
    return response(500, { message: "تعذر البحث عن الأنشطة حاليًا" });
  }
};
