"use strict";

const crypto = require("crypto");
const { getDb } = require("../lib/db");
const {
  getJwtSecret,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  createSignupToken,
  verifySignupToken,
} = require("../lib/auth");
const { SocialError, verifyIdToken } = require("../lib/social");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../lib/email");
const { clientKey, rateLimit, clearLimit } = require("../lib/rate-limit");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SOCIAL_PROVIDERS = ["google", "apple"];

const CODE_TTL_SECONDS = 600; // صلاحية الكود 10 دقائق
const MAX_CODE_ATTEMPTS = 5; // عدد محاولات إدخال الكود الواحد

// قائمة جزئية بخدمات البريد المؤقت المعروفة (أضف إليها حسب الحاجة)
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "throwawaymail.com",
  "maildrop.cc",
  "dispostable.com",
]);

function response(statusCode, data) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(data),
  };
}

function tooMany(limit, message) {
  const minutes = Math.max(1, Math.ceil(limit.retryAfter / 60));

  return {
    statusCode: 429,
    headers: { ...headers, "Retry-After": String(limit.retryAfter) },
    body: JSON.stringify({
      message: message || `محاولات كثيرة، حاول بعد ${minutes} دقيقة`,
    }),
  };
}

function parseBody(event) {
  try {
    return { body: JSON.parse(event.body || "{}") };
  } catch {
    return { error: response(400, { message: "بيانات الطلب غير صالحة" }) };
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isDisposableEmail(email) {
  const domain = email.split("@")[1] || "";
  return DISPOSABLE_DOMAINS.has(domain);
}

// bcrypt يقطع كلمة المرور عند 72 بايت، والحرف العربي يأخذ بايتين
function passwordTooLong(password) {
  return Buffer.byteLength(password, "utf8") > 72;
}

function publicUser(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
  };
}

function socialErrorResponse(error) {
  if (!(error instanceof SocialError)) return null;

  if (error.code === "not_configured") {
    return response(503, { message: "طريقة الدخول هذه غير مفعّلة حاليًا" });
  }

  if (error.code === "network") {
    console.error("Social provider error:", error.message);
    return response(502, { message: "تعذر الاتصال بالخدمة، حاول لاحقًا" });
  }

  return response(401, { message: "تعذر التحقق من الحساب، حاول مرة أخرى" });
}

async function findSocialUser(db, provider, subject) {
  const result = await db.execute({
    sql: `SELECT u.id, u.name, u.email, u.phone, u.role, u.email_verified_at
          FROM social_identities s
          JOIN users u ON u.id = s.user_id
          WHERE s.provider = ? AND s.subject = ?
          LIMIT 1`,
    args: [provider, subject],
  });

  return result.rows[0] || null;
}

function loginResponse(row) {
  const user = publicUser(row);

  return response(200, {
    message: "تم تسجيل الدخول بنجاح",
    user,
    token: createToken(user),
  });
}

function codeHash(userId, code) {
  return crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${userId}:${code}`)
    .digest("hex");
}

function safeEqualHex(a, b) {
  const first = Buffer.from(String(a), "hex");
  const second = Buffer.from(String(b), "hex");

  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

// ينشئ كودًا جديدًا ويلغي أي كود قديم للمستخدم
async function issueCode(db, userId) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const expiresAt = Math.floor(Date.now() / 1000) + CODE_TTL_SECONDS;

  await db.batch(
    [
      {
        sql: "DELETE FROM email_verifications WHERE user_id = ?",
        args: [userId],
      },
      {
        sql: `INSERT INTO email_verifications (user_id, code_hash, expires_at)
              VALUES (?, ?, ?)`,
        args: [userId, codeHash(userId, code), expiresAt],
      },
    ],
    "write"
  );

  return code;
}

// ينشئ كود استعادة كلمة المرور (صالح 15 دقيقة)
async function issueResetCode(db, userId) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const expiresAt = Math.floor(Date.now() / 1000) + 900;

  await db.batch(
    [
      {
        sql: "DELETE FROM password_resets WHERE user_id = ?",
        args: [userId],
      },
      {
        sql: `INSERT INTO password_resets (user_id, code_hash, expires_at)
              VALUES (?, ?, ?)`,
        args: [userId, codeHash(userId, code), expiresAt],
      },
    ],
    "write"
  );

  return code;
}

// حد إرسال الإيميل: مرة كل دقيقة، و5 مرات في الساعة لكل بريد
async function checkMailLimit(db, email) {
  const perMinute = await rateLimit(db, `mail-min:${email}`, 1, 60);
  if (!perMinute.allowed) return perMinute;

  return rateLimit(db, `mail-hour:${email}`, 5, 3600);
}

async function sendCode(db, userId, email) {
  const code = await issueCode(db, userId);

  try {
    await sendVerificationEmail(email, code);
    return true;
  } catch (error) {
    console.error("Verification email error:", error.message);
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const action = event.queryStringParameters?.action;

  try {
    const db = getDb();
    const ip = clientKey(event);

    // ───────── إنشاء حساب ─────────
    if (event.httpMethod === "POST" && action === "register") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;
      const body = parsed.body;

      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = body.password;
      const phone = String(body.phone || "").trim();
      const role = body.role === "provider" ? "provider" : "customer";

      if (
        name.length < 2 ||
        name.length > 100 ||
        !isValidEmail(email) ||
        typeof password !== "string" ||
        password.length < 8 ||
        !/^7[0-9]{8}$/.test(phone)
      ) {
        return response(400, {
          message:
            "تحقق من الاسم والبريد وكلمة المرور. رقم الهاتف اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7.",
        });
      }

      if (passwordTooLong(password)) {
        return response(400, { message: "كلمة المرور طويلة جدًا" });
      }

      if (isDisposableEmail(email)) {
        return response(400, {
          message: "لا يمكن استخدام بريد مؤقت، استخدم بريدك الشخصي",
        });
      }

      // الحد حسب الشبكة: 10 تسجيلات في الساعة
      // (رفعناه عن 5 لأن شبكات الجوال قد يشترك فيها عدد كبير من الناس)
      const ipLimit = await rateLimit(db, `register:ip:${ip}`, 10, 3600);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      const existing = await db.execute({
        sql: "SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1",
        args: [email],
      });

      const found = existing.rows[0];

      if (found && found.email_verified_at) {
        return response(409, { message: "البريد الإلكتروني مسجل مسبقًا" });
      }

      const mailLimit = await checkMailLimit(db, email);
      if (!mailLimit.allowed) return tooMany(mailLimit);

      const passwordHash = await hashPassword(password);
      let userId;

      if (found) {
        // حساب غير مفعّل: نحدّث بياناته (لا يملك أي صلاحية قبل التفعيل)
        // حتى لا يقدر أحد يحجز بريد غيره بتسجيل غير مكتمل
        await db.execute({
          sql: `UPDATE users
                SET name = ?, password_hash = ?, phone = ?, role = ?
                WHERE id = ? AND email_verified_at IS NULL`,
          args: [name, passwordHash, phone, role, Number(found.id)],
        });

        userId = Number(found.id);
      } else {
        try {
          const result = await db.execute({
            sql: `INSERT INTO users (name, email, password_hash, phone, role)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [name, email, passwordHash, phone, role],
          });

          userId = Number(result.lastInsertRowid);
        } catch (error) {
          if (String(error.message).includes("UNIQUE")) {
            return response(409, {
              message: "البريد الإلكتروني مسجل مسبقًا",
            });
          }

          throw error;
        }
      }

      const emailSent = await sendCode(db, userId, email);

      return response(201, {
        message: emailSent
          ? "أرسلنا كود التحقق إلى بريدك الإلكتروني"
          : "تم إنشاء الحساب، لكن تعذر إرسال الكود. اضغط إعادة الإرسال",
        verification_required: true,
        email,
        email_sent: emailSent,
      });
    }

    // ───────── تأكيد البريد بالكود ─────────
    if (event.httpMethod === "POST" && action === "verify-email") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const email = String(parsed.body.email || "").trim().toLowerCase();
      const code = String(parsed.body.code || "").trim();

      const ipLimit = await rateLimit(db, `verify:ip:${ip}`, 30, 900);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      const invalid = () =>
        response(400, { message: "الكود غير صحيح أو منتهي الصلاحية" });

      if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return invalid();

      const userResult = await db.execute({
        sql: `SELECT id, name, email, phone, role, email_verified_at
              FROM users WHERE email = ? LIMIT 1`,
        args: [email],
      });

      const user = userResult.rows[0];
      if (!user) return invalid();

      if (user.email_verified_at) {
        return response(409, {
          message: "الحساب مفعّل مسبقًا، سجّل الدخول",
        });
      }

      const record = (
        await db.execute({
          sql: `SELECT id, code_hash, expires_at
                FROM email_verifications
                WHERE user_id = ?
                ORDER BY id DESC LIMIT 1`,
          args: [Number(user.id)],
        })
      ).rows[0];

      const now = Math.floor(Date.now() / 1000);

      if (!record || Number(record.expires_at) < now) return invalid();

      // نزيد عدّاد المحاولات قبل المقارنة، حتى لا تنفع المحاولات المتوازية
      const bump = await db.execute({
        sql: `UPDATE email_verifications
              SET attempts = attempts + 1
              WHERE id = ? AND attempts < ?`,
        args: [Number(record.id), MAX_CODE_ATTEMPTS],
      });

      if (bump.rowsAffected === 0) {
        return response(429, {
          message: "تجاوزت عدد المحاولات، اطلب كودًا جديدًا",
        });
      }

      if (!safeEqualHex(record.code_hash, codeHash(Number(user.id), code))) {
        return invalid();
      }

      await db.batch(
        [
          {
            sql: `UPDATE users SET email_verified_at = CURRENT_TIMESTAMP
                  WHERE id = ? AND email_verified_at IS NULL`,
            args: [Number(user.id)],
          },
          {
            sql: "DELETE FROM email_verifications WHERE user_id = ?",
            args: [Number(user.id)],
          },
        ],
        "write"
      );

      const safeUser = publicUser(user);

      return response(200, {
        message: "تم تفعيل حسابك بنجاح",
        user: safeUser,
        token: createToken(safeUser),
      });
    }

    // ───────── إعادة إرسال الكود ─────────
    if (event.httpMethod === "POST" && action === "resend-code") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const email = String(parsed.body.email || "").trim().toLowerCase();

      // رد موحّد، حتى لا يُعرف إن كان البريد مسجلًا أم لا
      const generic = () =>
        response(200, {
          message: "إذا كان الحساب بانتظار التفعيل فقد أرسلنا كودًا جديدًا",
        });

      if (!isValidEmail(email)) return generic();

      const ipLimit = await rateLimit(db, `resend:ip:${ip}`, 20, 3600);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      const mailLimit = await checkMailLimit(db, email);
      if (!mailLimit.allowed) return tooMany(mailLimit);

      const user = (
        await db.execute({
          sql: `SELECT id, email_verified_at FROM users
                WHERE email = ? LIMIT 1`,
          args: [email],
        })
      ).rows[0];

      if (user && !user.email_verified_at) {
        await sendCode(db, Number(user.id), email);
      }

      return generic();
    }

    // ───────── تسجيل الدخول ─────────
    if (event.httpMethod === "POST" && action === "login") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const email = String(parsed.body.email || "").trim().toLowerCase();
      const password = parsed.body.password;

      if (
        !isValidEmail(email) ||
        typeof password !== "string" ||
        password.length === 0 ||
        passwordTooLong(password)
      ) {
        return response(400, {
          message: "تحقق من البريد الإلكتروني وكلمة المرور",
        });
      }

      const ipLimit = await rateLimit(db, `login:ip:${ip}`, 40, 900);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      const emailLimit = await rateLimit(db, `login:email:${email}`, 8, 900);
      if (!emailLimit.allowed) return tooMany(emailLimit);

      const result = await db.execute({
        sql: `SELECT id, name, email, password_hash, phone, role,
                     email_verified_at
              FROM users WHERE email = ? LIMIT 1`,
        args: [email],
      });

      const row = result.rows[0];
      const passwordOk = await verifyPassword(password, row?.password_hash);

      if (!row || !passwordOk) {
        return response(401, {
          message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        });
      }

      await clearLimit(db, `login:email:${email}`);

      if (!row.email_verified_at) {
        return response(403, {
          code: "EMAIL_NOT_VERIFIED",
          email,
          message: "فعّل بريدك الإلكتروني أولًا بالكود الذي أرسلناه إليك",
        });
      }

      const user = publicUser(row);

      return response(200, {
        message: "تم تسجيل الدخول بنجاح",
        user,
        token: createToken(user),
      });
    }

    // ───────── إعدادات الدخول بـ Google وApple (معرّفات عامة فقط) ─────────
    if (event.httpMethod === "GET" && action === "social-config") {
      return response(200, {
        google: process.env.GOOGLE_CLIENT_ID
          ? { clientId: process.env.GOOGLE_CLIENT_ID }
          : null,
        apple:
          process.env.APPLE_CLIENT_ID && process.env.APPLE_REDIRECT_URI
            ? {
                clientId: process.env.APPLE_CLIENT_ID,
                redirectUri: process.env.APPLE_REDIRECT_URI,
              }
            : null,
      });
    }

    // ───────── الدخول عبر Google أو Apple ─────────
    if (event.httpMethod === "POST" && action === "social-login") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const provider = String(parsed.body.provider || "");

      if (!SOCIAL_PROVIDERS.includes(provider)) {
        return response(400, { message: "طريقة الدخول غير معروفة" });
      }

      const ipLimit = await rateLimit(db, `social:ip:${ip}`, 30, 900);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      let claims;

      try {
        claims = await verifyIdToken(provider, parsed.body.credential);
      } catch (error) {
        const handled = socialErrorResponse(error);
        if (handled) return handled;
        throw error;
      }

      let row = await findSocialUser(db, provider, claims.subject);

      if (!row) {
        if (!claims.email || !claims.emailVerified) {
          return response(400, {
            message: "لم نتمكن من الحصول على بريد مؤكد من هذا الحساب",
          });
        }

        const byEmail = (
          await db.execute({
            sql: `SELECT id, name, email, phone, role, email_verified_at
                  FROM users WHERE email = ? LIMIT 1`,
            args: [claims.email],
          })
        ).rows[0];

        if (byEmail) {
          // الحساب موجود بنفس البريد: نربط الهوية به (البريد مؤكد من Google/Apple)
          await db.execute({
            sql: `INSERT OR IGNORE INTO social_identities
                    (provider, subject, user_id)
                  VALUES (?, ?, ?)`,
            args: [provider, claims.subject, Number(byEmail.id)],
          });

          row = byEmail;
        }
      }

      if (row) {
        const sameEmail =
          claims.emailVerified &&
          claims.email === String(row.email).toLowerCase();

        if (!row.email_verified_at && sameEmail) {
          await db.execute({
            sql: `UPDATE users SET email_verified_at = CURRENT_TIMESTAMP
                  WHERE id = ? AND email_verified_at IS NULL`,
            args: [Number(row.id)],
          });
        } else if (!row.email_verified_at) {
          return response(403, {
            code: "EMAIL_NOT_VERIFIED",
            email: row.email,
            message: "فعّل بريدك الإلكتروني أولًا",
          });
        }

        return loginResponse(row);
      }

      // حساب جديد: نطلب من المستخدم إكمال بياناته (الاسم والرقم ونوع الحساب)
      const suggestedName = (
        claims.name || String(parsed.body.name || "")
      )
        .trim()
        .slice(0, 100);

      return response(200, {
        needs_profile: true,
        email: claims.email,
        name: suggestedName,
        signup_token: createSignupToken({
          provider,
          subject: claims.subject,
          email: claims.email,
          name: suggestedName,
        }),
      });
    }

    // ───────── إكمال إنشاء حساب Google/Apple ─────────
    if (event.httpMethod === "POST" && action === "social-signup") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const signup = verifySignupToken(parsed.body.signup_token);

      if (
        !signup ||
        !SOCIAL_PROVIDERS.includes(signup.provider) ||
        typeof signup.subject !== "string" ||
        !signup.subject ||
        !isValidEmail(String(signup.email || ""))
      ) {
        return response(400, {
          message: "انتهت صلاحية الجلسة، أعد المحاولة من البداية",
        });
      }

      const name = String(parsed.body.name || "").trim();
      const phone = String(parsed.body.phone || "").trim();
      const role = parsed.body.role === "provider" ? "provider" : "customer";

      if (name.length < 2 || name.length > 100 || !/^7[0-9]{8}$/.test(phone)) {
        return response(400, {
          message:
            "تحقق من الاسم. رقم الهاتف اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7.",
        });
      }

      const ipLimit = await rateLimit(db, `social-signup:ip:${ip}`, 10, 3600);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      const email = String(signup.email).toLowerCase();

      // إذا أُنشئ الحساب فعلاً (ضغط مزدوج مثلاً) نكتفي بتسجيل الدخول
      const already = await findSocialUser(db, signup.provider, signup.subject);
      if (already) return loginResponse(already);

      const taken = await db.execute({
        sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
        args: [email],
      });

      if (taken.rows.length) {
        return response(409, {
          message: "هذا البريد مسجل مسبقًا، ارجع واضغط تسجيل الدخول",
        });
      }

      // لا توجد كلمة مرور لهذا الحساب: نخزّن قيمة عشوائية لا يعرفها أحد
      const passwordHash = await hashPassword(
        crypto.randomBytes(32).toString("hex")
      );

      try {
        await db.batch(
          [
            {
              sql: `INSERT INTO users
                      (name, email, password_hash, phone, role, email_verified_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              args: [name, email, passwordHash, phone, role],
            },
            {
              sql: `INSERT INTO social_identities (provider, subject, user_id)
                    VALUES (?, ?, (SELECT id FROM users WHERE email = ?))`,
              args: [signup.provider, signup.subject, email],
            },
          ],
          "write"
        );
      } catch (error) {
        if (String(error.message).includes("UNIQUE")) {
          return response(409, {
            message: "هذا الحساب مسجل مسبقًا، ارجع واضغط تسجيل الدخول",
          });
        }

        throw error;
      }

      const created = (
        await db.execute({
          sql: `SELECT id, name, email, phone, role, email_verified_at
                FROM users WHERE email = ? LIMIT 1`,
          args: [email],
        })
      ).rows[0];

      const user = publicUser(created);

      return response(201, {
        message: "تم إنشاء حسابك بنجاح",
        user,
        token: createToken(user),
      });
    }

    // ───────── بيانات الحساب الحالي ─────────
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
        sql: `SELECT id, name, email, phone, role, email_verified_at
              FROM users WHERE id = ? LIMIT 1`,
        args: [Number(payload.sub)],
      });

      const row = result.rows[0];

      if (!row) {
        return response(401, { message: "الحساب غير موجود" });
      }

      if (!row.email_verified_at) {
        return response(401, { message: "فعّل بريدك الإلكتروني أولًا" });
      }

      if (!["customer", "provider", "admin"].includes(row.role)) {
        return response(403, { message: "نوع الحساب غير صالح" });
      }

      return response(200, { user: publicUser(row) });
    }

    // ───────── طلب استعادة كلمة المرور (إرسال كود) ─────────
    if (event.httpMethod === "POST" && action === "forgot-password") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const email = String(parsed.body.email || "").trim().toLowerCase();

      const generic = () =>
        response(200, {
          message: "إذا كان هذا البريد مسجلاً لدينا، فقد أرسلنا رمز استعادة كلمة المرور.",
        });

      if (!isValidEmail(email)) return generic();

      const ipLimit = await rateLimit(db, `forgot:ip:${ip}`, 10, 3600);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      const mailLimit = await checkMailLimit(db, email);
      if (!mailLimit.allowed) return tooMany(mailLimit);

      const user = (
        await db.execute({
          sql: "SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1",
          args: [email],
        })
      ).rows[0];

      if (user && user.email_verified_at) {
        const code = await issueResetCode(db, Number(user.id));
        try {
          await sendPasswordResetEmail(email, code);
        } catch (err) {
          console.error("Password reset email error:", err.message);
        }
      }

      return generic();
    }

    // ───────── تعيين كلمة المرور الجديدة باستخدام الكود ─────────
    if (event.httpMethod === "POST" && action === "reset-password") {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const email = String(parsed.body.email || "").trim().toLowerCase();
      const code = String(parsed.body.code || "").trim();
      const newPassword = parsed.body.new_password;

      if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
        return response(400, { message: "الرمز غير صحيح أو منتهي الصلاحية" });
      }

      if (
        typeof newPassword !== "string" ||
        newPassword.length < 8 ||
        passwordTooLong(newPassword)
      ) {
        return response(400, { message: "كلمة المرور يجب أن لا تقل عن 8 أحرف" });
      }

      const ipLimit = await rateLimit(db, `reset:ip:${ip}`, 20, 900);
      if (!ipLimit.allowed) return tooMany(ipLimit);

      const user = (
        await db.execute({
          sql: "SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1",
          args: [email],
        })
      ).rows[0];

      if (!user) {
        return response(400, { message: "الرمز غير صحيح أو منتهي الصلاحية" });
      }

      const record = (
        await db.execute({
          sql: `SELECT id, code_hash, expires_at
                FROM password_resets
                WHERE user_id = ?
                ORDER BY id DESC LIMIT 1`,
          args: [Number(user.id)],
        })
      ).rows[0];

      const now = Math.floor(Date.now() / 1000);

      if (!record || Number(record.expires_at) < now) {
        return response(400, { message: "الرمز غير صحيح أو منتهي الصلاحية" });
      }

      const bump = await db.execute({
        sql: `UPDATE password_resets
              SET attempts = attempts + 1
              WHERE id = ? AND attempts < 5`,
        args: [Number(record.id)],
      });

      if (bump.rowsAffected === 0) {
        return response(429, { message: "تجاوزت عدد المحاولات، اطلب رمزاً جديداً" });
      }

      if (!safeEqualHex(record.code_hash, codeHash(Number(user.id), code))) {
        return response(400, { message: "الرمز غير صحيح" });
      }

      const passwordHash = await hashPassword(newPassword);

      await db.batch(
        [
          {
            sql: "UPDATE users SET password_hash = ? WHERE id = ?",
            args: [passwordHash, Number(user.id)],
          },
          {
            sql: "DELETE FROM password_resets WHERE user_id = ?",
            args: [Number(user.id)],
          },
        ],
        "write"
      );

      return response(200, {
        message: "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
      });
    }

    // ───────── تحديث الملف الشخصي (الاسم ورقم الهاتف) ─────────
    if (event.httpMethod === "POST" && action === "update-profile") {
      const payload = verifyToken(event);
      if (!payload || !Number.isSafeInteger(Number(payload.sub))) {
        return response(401, { message: "يلزم تسجيل الدخول مجددًا" });
      }

      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const name = String(parsed.body.name || "").trim();
      const phone = String(parsed.body.phone || "").trim();

      if (name.length < 2 || name.length > 100) {
        return response(400, { message: "الاسم يجب أن يكون بين حرفين و100 حرف" });
      }

      if (!/^7[0-9]{8}$/.test(phone)) {
        return response(400, {
          message: "رقم الهاتف اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7",
        });
      }

      const userId = Number(payload.sub);

      await db.execute({
        sql: "UPDATE users SET name = ?, phone = ? WHERE id = ?",
        args: [name, phone, userId],
      });

      const updated = (
        await db.execute({
          sql: "SELECT id, name, email, phone, role FROM users WHERE id = ? LIMIT 1",
          args: [userId],
        })
      ).rows[0];

      return response(200, {
        message: "تم تحديث البيانات بنجاح",
        user: publicUser(updated),
      });
    }

    // ───────── تغيير كلمة المرور للمستخدم المسجل ─────────
    if (event.httpMethod === "POST" && action === "change-password") {
      const payload = verifyToken(event);
      if (!payload || !Number.isSafeInteger(Number(payload.sub))) {
        return response(401, { message: "يلزم تسجيل الدخول مجددًا" });
      }

      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;

      const currentPassword = parsed.body.current_password;
      const newPassword = parsed.body.new_password;

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        newPassword.length < 8 ||
        passwordTooLong(newPassword)
      ) {
        return response(400, {
          message: "تحقق من كلمة المرور الحالية، ويجب أن لا تقل الجديدة عن 8 أحرف",
        });
      }

      const userId = Number(payload.sub);

      const user = (
        await db.execute({
          sql: "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
          args: [userId],
        })
      ).rows[0];

      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
        return response(400, { message: "كلمة المرور الحالية غير صحيحة" });
      }

      const newHash = await hashPassword(newPassword);

      await db.execute({
        sql: "UPDATE users SET password_hash = ? WHERE id = ?",
        args: [newHash, userId],
      });

      return response(200, { message: "تم تغيير كلمة المرور بنجاح" });
    }

    return response(404, {
      message: "المسار غير معروف",
      usage: [
        "POST ?action=register",
        "POST ?action=verify-email",
        "POST ?action=resend-code",
        "POST ?action=login",
        "POST ?action=social-login",
        "POST ?action=social-signup",
        "GET ?action=social-config",
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
