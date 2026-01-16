// apps/web/lib/verifyToken.js
import crypto from "crypto";

export function makeVerifyToken() {
  // token público (va en URL)
  const token = crypto.randomBytes(32).toString("hex");
  // hash que guardamos en DB
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}
