import crypto from "crypto";
import { env } from "@/lib/env";

const KEY = crypto.createHash("sha256").update(env.sessionSecret).digest();

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string | Buffer) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacHex(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export function hmacBase64Url(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64url");
}

export function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** AES-256-GCM encryption for stored third-party tokens and secrets. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [v, ivB, tagB, encB] = payload.split(".");
    if (v !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encB, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Sign a short-lived value (e.g. cookie) with HMAC: value.sig */
export function sign(value: string) {
  return `${value}.${hmacBase64Url(env.sessionSecret, value)}`;
}
export function unsign(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  return timingSafeEqual(sig, hmacBase64Url(env.sessionSecret, value)) ? value : null;
}
