import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { createDb } from "$lib/server/db/client";
import { toErrorResponse } from "$lib/server/http/response";
import { transitionPost } from "$lib/server/services/posts";

export async function POST({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "admin"); // unpublish defaults to admin-only; relax per §2-3 ※1 if needed

    await transitionPost(db, params.id!, "draft", session);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
