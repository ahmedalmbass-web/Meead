
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

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, {
      message: "بيانات البحث غير صالحة",
    });
  }

  const searchTerm = String(body.search_term || "").trim().slice(0, 150);
  const category = String(body.category || "").trim().slice(0, 100);
  const city = String(body.city || "").trim().slice(0, 100);
  const resultsCount = Number(body.results_count);

  if (!searchTerm) {
    return response(400, {
      message: "عبارة البحث مطلوبة",
    });
  }

  if (
    !Number.isSafeInteger(resultsCount) ||
    resultsCount < 0 ||
    resultsCount > 100000
  ) {
    return response(400, {
      message: "عدد النتائج غير صالح",
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
