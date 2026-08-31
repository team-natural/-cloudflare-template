// DEV-04 §5-1. `admin_session` cookie only — no Authorization header, no JWT (DEV-01 §2).
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { ZodError, flattenError } from "zod";
import { assertNotLockedOut, clearAuthFailures, recordAuthFailure } from "$lib/server/auth/lockout";
import { ADMIN_SESSION_COOKIE } from "$lib/server/auth/session";
import { createDb } from "$lib/server/db/client";
import { UnauthenticatedError, ValidationError } from "$lib/server/http/errors";
import { jsonItem, toErrorResponse } from "$lib/server/http/response";
import { toPublicAdminUser } from "$lib/server/services/admin-users";
import { login } from "$lib/server/services/auth";
import { loginSchema } from "$lib/server/validation/auth";

export async function POST({ request, cookies, clientAddress }: APIContext): Promise<Response> {
  let lockoutScope: { ip: string; email: string } | undefined;
  try {
    const db = createDb(env.DB);
    const { email, password } = loginSchema.parse(await request.json());

    // Brute-force lockout (DEV-02 §7): check before verifying credentials
    const ip = request.headers.get("cf-connecting-ip") ?? clientAddress;
    lockoutScope = { ip, email };
    await assertNotLockedOut(env.KV, ip, email);

    const ttlDays = Number(env.SESSION_TTL_DAYS);
    const { session, user } = await login(db, email, password, ttlDays);
    await clearAuthFailures(env.KV, ip, email);

    cookies.set(ADMIN_SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expiresAt),
    });

    return jsonItem(toPublicAdminUser(user));
  } catch (error) {
    if (error instanceof UnauthenticatedError && lockoutScope) {
      await recordAuthFailure(env.KV, lockoutScope.ip, lockoutScope.email, {
        maxAttempts: Number(env.AUTH_LOCKOUT_MAX_ATTEMPTS),
        lockoutMinutes: Number(env.AUTH_LOCKOUT_MINUTES),
      });
    }
    if (error instanceof ZodError) {
      return toErrorResponse(new ValidationError(flattenError(error).fieldErrors));
    }
    return toErrorResponse(error);
  }
}
