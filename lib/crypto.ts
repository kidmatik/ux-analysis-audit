import crypto from "node:crypto";

// Temporary credentials (demo passwords, Figma tokens) are encrypted at rest with AES-256-GCM
// and wiped as soon as the analysis finishes. See purgeSecrets in lib/engine/pipeline.ts.

function key() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY or NEXTAUTH_SECRET must be set");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64")).join(".");
}

export function decryptJson<T>(payload: string): T {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

export function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url");
}
