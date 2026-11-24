// Creates (or resets the password of) an account in the LOCAL demo store (.data/, never committed).
// Usage: node scripts/create-local-user.mjs <login> <password>
// Not used with Supabase: there, users are created in the Supabase dashboard.
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [login, password] = process.argv.slice(2);
if (!login || !password) {
  console.error("Usage: node scripts/create-local-user.mjs <login> <password>");
  process.exit(1);
}
const root = process.env.KRIS_DATA_DIR ? path.resolve(process.env.KRIS_DATA_DIR) : path.resolve(".data");
const file = path.join(root, "db", "profiles.json");
fs.mkdirSync(path.dirname(file), { recursive: true });
const users = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];

const salt = randomBytes(16);
const hash = `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
const id = login.toLowerCase();
const existing = users.find((u) => u.email === id);
const now = new Date().toISOString();
if (existing) {
  existing.password_hash = hash;
  existing.updated_at = now;
} else {
  const uid = randomUUID();
  users.push({ id: uid, owner_id: uid, email: id, display_name: login, password_hash: hash, created_at: now, updated_at: now });
}
fs.writeFileSync(file, JSON.stringify(users));
console.log(existing ? "password reset for" : "created", id);
