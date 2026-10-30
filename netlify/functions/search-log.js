
const { getDb } = require("../lib/db");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (event.httpMethod !== "POST") {
    return response(405, {
      message: "طريقة الطلب غير مسموحة",
    });
  }

    const rawBody = event.body || "";

  if (rawBody.length > 5000) {
    return response(413, {
      message: "بيانات البحث أكبر من الحجم المسموح",
    });
  }

  let body;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return response(400, {
      message: "بيانات البحث غير صالحة",
    });
  }

    if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.search_term !== "string" ||
    (body.category != null && typeof body.category !== "string") ||
    (body.city != null && typeof body.city !== "string")
  ) {
    return response(400, {
      message: "صيغة بيانات البحث غير صحيحة",
    });
  }

  const searchTerm = body.search_term.trim().slice(0, 150);
  const category = (body.category || "").trim().slice(0, 100);
  const city = (body.city || "").trim().slice(0, 100);
    const resultsCount = body.results_count;

  if (
    typeof resultsCount !== "number" ||
    !Number.isSafeInteger(resultsCount) ||
    resultsCount < 0 ||
    resultsCount > 100000
  ) {
    return response(400, {
      message: "عدد النتائج غير صالح",
    });
  }

  if (!searchTerm) {
    return response(400, {
      message: "عبارة البحث مطلوبة",
    });
  }

  

  try {
    const db = getDb();

    await db.execute({
      sql: `INSERT INTO search_logs
            (search_term, category, city, results_count)
            VALUES (?, ?, ?, ?)`,
      args: [
        searchTerm,
        category || null,
        city || null,
        resultsCount,
      ],
    });

    return response(201, {
      message: "تم تسجيل عملية البحث",
    });
  } catch (error) {
    console.error("Search log error:", error.message);

    return response(500, {
      message: "تعذر تسجيل عملية البحث",
    });
  }
};
