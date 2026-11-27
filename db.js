
const { createClient } = require("@libsql/client");

let client;

function getDb() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing Turso environment variables");
  }

  client = createClient({
    url,
    authToken,
  });

  return client;
}

module.exports = { getDb };
