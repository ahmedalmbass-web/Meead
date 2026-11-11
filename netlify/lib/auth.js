const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured securely");
  }

  return secret;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

// hash وهمي يُستخدم عندما لا يوجد حساب بهذا البريد،
// حتى يستغرق الرد نفس الوقت ولا يمكن معرفة الإيميلات المسجلة من سرعته
let dummyHashPromise = null;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash("meead-dummy-password", 12);
  }

  return dummyHashPromise;
}

async function verifyPassword(password, passwordHash) {
  const hash = passwordHash || (await getDummyHash());
  const matches = await bcrypt.compare(password, hash);

  return Boolean(passwordHash) && matches;
}

function createToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: "2h", algorithm: "HS256" }
  );
}

function verifyToken(event) {
  const header =
    event.headers?.authorization ||
    event.headers?.Authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  try {
    return jwt.verify(header.slice(7), getJwtSecret(), {
      algorithms: ["HS256"],
    });
  } catch {
    return null;
  }
}

module.exports = {
  getJwtSecret,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
};
