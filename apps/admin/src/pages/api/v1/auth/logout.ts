// DEV-04 §5-1. Row deletion (session.ts's destroySession), not a status flag — see DEV-02 §1-1.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "$lib/server/db/client";
import { toErrorResponse } from "$lib/server/http/response";
import { ADMIN_SESSION_COOKIE, requireSession } from "$lib/server/auth/session";
import { logout } from "$lib/server/services/auth";

export async function POST({ cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);

    const token = cookies.get(ADMIN_SESSION_COOKIE)!.value;
    await logout(db, token);
    cookies.delete(ADMIN_SESSION_COOKIE, { path: "/" });

    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
