import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { one } from "./db";
import type { Shop } from "./domain";

const COOKIE = "confirmo_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum)");
  return new TextEncoder().encode(s);
}

export async function startSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export type Session = { userId: string; email: string; shop: Shop };

export async function getSession(): Promise<Session | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const row = await one<any>(
    `select u.id as user_id, u.email, s.id, s.name, s.ship_fee, s.return_fee, s.ad_cost, s.high_amount, s.risky_cities, s.webhook_token
       from users u join shops s on s.user_id = u.id where u.id = $1`,
    [uid],
  );
  if (!row) return null;
  const { user_id, email, ...shop } = row;
  return { userId: user_id, email, shop: shop as Shop };
}

/** Pour les routes API : renvoie la session ou une réponse 401. */
export async function requireApi(): Promise<Session | NextResponse> {
  const s = await getSession();
  return s ?? NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
}
