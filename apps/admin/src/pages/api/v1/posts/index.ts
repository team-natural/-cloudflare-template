// Reference API Route (DEV-04 §5-3 pattern). Input/output handling only — all business logic
// lives in src/lib/server/services/posts.ts.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { ZodError, flattenError } from "zod";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { createDb } from "$lib/server/db/client";
import { ValidationError } from "$lib/server/http/errors";
import { decodeCursor, encodeCursor } from "$lib/server/http/pagination";
import { jsonCursorCollection, jsonItem, toErrorResponse } from "$lib/server/http/response";
import { createPost, listPosts } from "$lib/server/services/posts";
import { createPostSchema } from "$lib/server/validation/posts";

export async function GET({ request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);

    const url = new URL(request.url);
    const afterId = decodeCursor(url.searchParams.get("cursor"));
    const perPageParam = url.searchParams.get("per_page");
    const perPage = perPageParam ? Number(perPageParam) : undefined;

    const { items, nextId } = await listPosts(db, { afterId, perPage });
    return jsonCursorCollection(items, {
      perPage: perPage ?? 20,
      nextCursor: nextId ? encodeCursor(nextId) : null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST({ request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor"); // admin implicitly satisfies this (DEV-02 §3-2)

    const input = createPostSchema.parse(await request.json());
    const post = await createPost(db, input, session);
    return jsonItem(post, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return toErrorResponse(new ValidationError(flattenError(error).fieldErrors));
    }
    return toErrorResponse(error);
  }
}
