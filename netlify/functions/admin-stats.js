
const { getDb } = require("../lib/db");
const { verifyToken } = require("../lib/auth");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    return response(405, { message: "طريقة الطلب غير مسموحة" });
  }

  try {
    const payload = verifyToken(event);

    if (
  !payload ||
  !Number.isSafeInteger(Number(payload.sub)) ||
  Number(payload.sub) <= 0
) {
  return response(401, {
    message: "سجّل الدخول مجددًا للوصول إلى لوحة الإدارة",
  });
    }

    const db = getDb();

    // التحقق من دور الحساب الحالي في قاعدة البيانات،
    // وليس الاعتماد على الدور المخزن داخل رمز الدخول.
    const accountResult = await db.execute({
      sql: "SELECT role FROM users WHERE id = ? LIMIT 1",
      args: [Number(payload.sub)],
    });

    const account = accountResult.rows[0];

    if (!account || account.role !== "admin") {
      return response(403, {
        message: "ليس لديك صلاحية الوصول إلى إحصائيات الإدارة",
      });
    }

    
    const [
      usersResult,
      providersResult,
      servicesResult,
      bookingsResult,
      searchTotalsResult,
      popularSearchesResult,
      noResultsSearchesResult,
    ] = await Promise.all([

      db.execute(`
        SELECT
          COUNT(*) AS total_users,
          COALESCE(SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END), 0)
            AS customers,
          COALESCE(SUM(CASE WHEN role = 'provider' THEN 1 ELSE 0 END), 0)
            AS provider_accounts,
          COALESCE(SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END), 0)
            AS admins
        FROM users
      `),

      db.execute(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END), 0)
            AS published,
          COALESCE(SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END), 0)
            AS unpublished
        FROM providers
      `),

      db.execute(`
        SELECT COUNT(*) AS total
        FROM services
      `),

      db.execute(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
            AS pending,
          COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0)
            AS confirmed,
          COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0)
            AS cancelled
        FROM bookings
      `),

      
      db.execute(`
        SELECT
          COUNT(*) AS total_searches,
          COALESCE(SUM(results_count = 0), 0) AS searches_without_results
        FROM search_logs
      `),

      db.execute(`
        SELECT
          search_term,
          COUNT(*) AS search_count,
          MAX(created_at) AS last_searched
        FROM search_logs
        GROUP BY LOWER(TRIM(search_term))
        ORDER BY search_count DESC, last_searched DESC
        LIMIT 10
      `),

      db.execute(`
        SELECT
          search_term,
          COUNT(*) AS search_count,
          MAX(created_at) AS last_searched
        FROM search_logs
        WHERE results_count = 0
        GROUP BY LOWER(TRIM(search_term))
        ORDER BY search_count DESC, last_searched DESC
        LIMIT 10
      `),

    ]);

    const number = (value) => Number(value || 0);

    const users = usersResult.rows[0];
    const providers = providersResult.rows[0];
    const services = servicesResult.rows[0];
    const bookings = bookingsResult.rows[0];

    return response(200, {
      stats: {
        users: {
          total: number(users.total_users),
          customers: number(users.customers),
          providerAccounts: number(users.provider_accounts),
          admins: number(users.admins),
        },
        providers: {
          total: number(providers.total),
          published: number(providers.published),
          unpublished: number(providers.unpublished),
        },
        services: {
          total: number(services.total),
        },
        bookings: {
          total: number(bookings.total),
          pending: number(bookings.pending),
          confirmed: number(bookings.confirmed),
          cancelled: number(bookings.cancelled),
        },
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);

    return response(500, {
      message: "تعذر تحميل الإحصائيات حاليًا",
    });
  }
};
