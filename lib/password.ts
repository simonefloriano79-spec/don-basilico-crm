import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

const KEY_LENGTH = 64;
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): string {
  if (!password || password.length < 8) {
    throw new Error("La password deve contenere almeno 8 caratteri.");
  }

  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${key}`;
}

export function hashPasswordBcrypt(password: string): string {
  if (!password || password.length < 8) {
    throw new Error("La password deve contenere almeno 8 caratteri.");
  }

  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyScryptPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, key] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !key) return false;

  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const storedKey = Buffer.from(key, "hex");

  if (storedKey.length !== derivedKey.length) return false;
  return timingSafeEqual(storedKey, derivedKey);
}

export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith("scrypt$")) {
    return verifyScryptPassword(password, storedHash);
  }

  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    return bcrypt.compareSync(password, storedHash);
  }

  return false;
}
