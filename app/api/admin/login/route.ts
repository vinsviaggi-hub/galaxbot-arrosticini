import { NextResponse } from "next/server";
import { getCookieName, makeSessionToken } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = String(body?.password || "");

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
  const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

  if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSWORD o ADMIN_SESSION_SECRET mancanti" },
      { status: 500 }
    );
  }

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Password errata" }, { status: 401 });
  }

  const session = makeSessionToken(ADMIN_SESSION_SECRET);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // ✅ su localhost deve essere false
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export const dynamic = "force-dynamic";