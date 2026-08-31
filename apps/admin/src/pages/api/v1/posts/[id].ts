// Reference API Route (DEV-04 §5-3 pattern). `[id]` holds the post's public_id (ULID) — the
// internal integer id is never exposed in a URL (DEV-05 §2, DEV-07 §1).
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { ZodError, flattenError } from "zod";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { createDb } from "$lib/server/db/client";
import { ValidationError } from "$lib/server/http/errors";
import { jsonItem, toErrorResponse } from "$lib/server/http/response";
import { deletePost, getPostByPublicId, updatePost } from "$lib/server/services/posts";
import { updatePostSchema } from "$lib/server/validation/posts";

export async function GET({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);

    const post = await getPostByPublicId(db, params.id!);
    return jsonItem(post);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH({ params, request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");

    const input = updatePostSchema.parse(await request.json());
    const post = await updatePost(db, params.id!, input);
    return jsonItem(post);
  } catch (error) {
    if (error instanceof ZodError) {
      return toErrorResponse(new ValidationError(flattenError(error).fieldErrors));
    }
    return toErrorResponse(error);
  }
}

export async function DELETE({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");

    await deletePost(db, params.id!);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
