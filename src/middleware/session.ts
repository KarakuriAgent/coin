import { createHmac, timingSafeEqual } from "crypto";
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { config } from "../config.js";

interface SessionData {
  discord_id: string;
  username: string;
}

const COOKIE_NAME = "coin_session";

function sign(data: string): string {
  const sig = createHmac("sha256", config.sessionSecret)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const data = signed.slice(0, idx);
  const expected = sign(data);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signed);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return data;
}

export function getSession(c: { req: { raw: Request } } & any): SessionData | null {
  const cookie = getCookie(c, COOKIE_NAME);
  if (!cookie) return null;
  const data = verify(cookie);
  if (!data) return null;
  try {
    return JSON.parse(data) as SessionData;
  } catch {
    return null;
  }
}

export function setSession(c: any, data: SessionData) {
  const payload = JSON.stringify(data);
  const signed = sign(payload);
  setCookie(c, COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSession(c: any) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  c.set("session", getSession(c));
  return next();
};
