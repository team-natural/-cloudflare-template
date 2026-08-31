// State-transition action route (DEV-04 §5-3's `/{id}/[action]` pattern; DEV-09 §3-3). The
// transition itself — validity check, D1 update, audit log — lives in transitionPost()
// (src/lib/server/services/posts.ts), never inline here.
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
    requireRole(session, "editor"); // publish permission is a per-project call (DEV-02 §2-3 ※1)

    await transitionPost(db, params.id!, "published", session);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
