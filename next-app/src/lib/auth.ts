import { getIronSession, unsealData } from "iron-session";
import { cookies } from "next/headers";

const SESSION_OPTIONS = {
  cookieName: "crawlit_session",
  password: process.env.AUTH_SECRET ?? "min-32-char-secret-for-dev-only-change-in-prod",
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7 - 60, // 7 days minus 1 min
    path: "/",
  },
} as const;

export type SessionData = {
  userId: string;
  username: string;
  role: "admin" | "client";
};

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  if (!session.userId || !session.username) return null;
  return {
    userId: session.userId,
    username: session.username,
    role: session.role ?? "client",
  };
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  session.userId = data.userId;
  session.username = data.username;
  session.role = data.role;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  session.destroy();
}

/** Verify session cookie value (for middleware). Returns session data or null. */
export async function verifySessionCookie(cookieValue: string): Promise<SessionData | null> {
  try {
    const data = await unsealData<SessionData>(cookieValue, {
      password: SESSION_OPTIONS.password,
      ttl: SESSION_OPTIONS.ttl,
    });
    if (data?.userId && data?.username) return data;
  } catch {
    // invalid or expired
  }
  return null;
}

export { SESSION_OPTIONS };
