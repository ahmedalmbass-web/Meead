"use strict";

// التحقق من "توكن الهوية" (ID token) القادم من Google أو Apple.
// نتحقق من التوقيع بالمفاتيح العامة الرسمية، ومن الجهة المُصدِرة والجمهور والانتهاء.

const crypto = require("crypto");

class SocialError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // not_configured | invalid | network
  }
}

const PROVIDERS = {
  google: {
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    audience: () => process.env.GOOGLE_CLIENT_ID || "",
  },
  apple: {
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
    audience: () => process.env.APPLE_CLIENT_ID || "",
  },
};

const KEY_TTL_MS = 60 * 60 * 1000;
const KEY_REFETCH_MIN_MS = 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;

const keyCache = new Map();

function resetKeyCache() {
  keyCache.clear();
}

async function loadKeys(name, force = false) {
  const cached = keyCache.get(name);
  const now = Date.now();

  if (cached) {
    const age = now - cached.fetchedAt;
    if (!force && age < KEY_TTL_MS) return cached.keys;
    if (force && age < KEY_REFETCH_MIN_MS) return cached.keys;
  }

  let body;

  try {
    const response = await fetch(PROVIDERS[name].jwksUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`status ${response.status}`);
    body = await response.json();
  } catch (error) {
    throw new SocialError("network", error.message);
  }

  const keys = new Map();

  for (const jwk of body.keys || []) {
    if (jwk.kty !== "RSA" || !jwk.kid) continue;

    try {
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
    } catch {
      /* نتجاهل المفتاح غير الصالح */
    }
  }

  if (!keys.size) throw new SocialError("network", "no keys");

  keyCache.set(name, { keys, fetchedAt: now });
  return keys;
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

async function verifyIdToken(name, idToken) {
  const config = PROVIDERS[name];
  const invalid = () => new SocialError("invalid");

  if (!config) throw invalid();

  const audience = config.audience();
  if (!audience) throw new SocialError("not_configured");

  if (typeof idToken !== "string" || idToken.length > 4096) throw invalid();

  const parts = idToken.split(".");
  if (parts.length !== 3) throw invalid();

  let header;
  let payload;

  try {
    header = decodeSegment(parts[0]);
    payload = decodeSegment(parts[1]);
  } catch {
    throw invalid();
  }

  // نقبل RS256 فقط (يمنع هجمات تغيير الخوارزمية)
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw invalid();

  let key = (await loadKeys(name)).get(header.kid);

  if (!key) {
    key = (await loadKeys(name, true)).get(header.kid);
  }

  if (!key) throw invalid();

  let signatureOk = false;

  try {
    signatureOk = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], "base64url")
    );
  } catch {
    signatureOk = false;
  }

  if (!signatureOk) throw invalid();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (
    !config.issuers.includes(payload.iss) ||
    !audiences.includes(audience) ||
    typeof payload.exp !== "number" ||
    payload.exp + CLOCK_SKEW_SECONDS < nowSeconds ||
    (typeof payload.iat === "number" &&
      payload.iat - CLOCK_SKEW_SECONDS > nowSeconds) ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 255
  ) {
    throw invalid();
  }

  return {
    subject: payload.sub,
    email:
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "",
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
    name:
      typeof payload.name === "string" ? payload.name.trim().slice(0, 100) : "",
  };
}

module.exports = { SocialError, verifyIdToken, resetKeyCache };
