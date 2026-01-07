import crypto from "crypto";

const COOKIE_NAME = "admin_session";

function hmac(input: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function makeSessionToken(secret: string) {
  const token = crypto.randomBytes(24).toString("hex");
  const sig = hmac(token, secret);
  return `${token}.${sig}`;
}

export function verifySessionToken(value: string | undefined, secret: string) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [token, sig] = parts;
  const expected = hmac(token, secret);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}