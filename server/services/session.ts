import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { config } from "../config";
import { ApiError } from "../lib/errors";
import { sessions, users, type UserDoc } from "../repositories/krug";

const COOKIE = "krug_session";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function tokenFrom(request: Request) {
  const part = request.headers.cookie?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`));
  const token = part?.slice(COOKIE.length + 1);
  return token && /^[a-f\d]{64}$/.test(token) ? token : undefined;
}
export async function currentUser(request: Request): Promise<UserDoc | null> {
  const token = tokenFrom(request);
  if (!token) return null;
  const session = await sessions.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  return session ? users.findOne({ _id: session.userId }) : null;
}
export async function requireUser(request: Request) {
  const user = await currentUser(request);
  if (!user) throw new ApiError(401, "Представьтесь, чтобы продолжить.");
  return user;
}
export async function clearSession(request: Request, response: Response) {
  const token = tokenFrom(request);
  if (token) await sessions.deleteOne({ tokenHash: hash(token) });
  response.clearCookie(COOKIE, { path: "/api/krug", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && request.secure });
}
export async function createSession(user: UserDoc, request: Request, response: Response) {
  const previous = tokenFrom(request);
  if (previous) await sessions.deleteOne({ tokenHash: hash(previous) });
  const token = randomBytes(32).toString("hex");
  const maxAge = config.sessionDays * 24 * 60 * 60_000;
  await sessions.insertOne({ _id: new ObjectId(), userId: user._id, tokenHash: hash(token), expiresAt: new Date(Date.now() + maxAge) });
  response.cookie(COOKIE, token, { path: "/api/krug", httpOnly: true, sameSite: "lax", secure: request.secure, maxAge });
}
