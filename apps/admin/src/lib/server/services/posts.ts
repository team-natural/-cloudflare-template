// Reference Service implementation for the "Service → D1 (Drizzle)" layer (DEV-01 §5-3, DEV-05
// §2). This is the confirmed shape the `scaffold` skill will stamp out for new resources —
// see docs/3-development/09-state-machine-spec.md §3 for the state-transition principles this
// follows, and DEV-05 §1/§2 for why this uses Drizzle + public_id instead of DEV-09's
// illustrative env.DB.prepare()/internal-id sketch.
import { eq, gt } from "drizzle-orm";
import type { DbClient } from "../db/client";
import { posts } from "@app/schema";
import { ulid } from "@app/schema/ulid";
import { InvalidStateTransitionError, NotFoundError } from "../http/errors";
import type { Session } from "../auth/session";
import type { CreatePostInput, UpdatePostInput } from "../validation/posts";
import { activityLogInsert } from "./activity-log";

export type PostStatus = "draft" | "published" | "archived";

const TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ["published"],
  published: ["draft", "archived"],
  archived: ["published"],
};

export function allowedTransitions(status: PostStatus): PostStatus[] {
  return TRANSITIONS[status] ?? [];
}

// The internal INTEGER PRIMARY KEY never leaves this layer — API clients only ever see
// public_id as `id` (DEV-05 §2, DEV-07 §1). authorId/categoryId are dropped for the same
// reason: they are internal integer FKs. Expose them again only as the referenced row's
// public key if a screen needs them.
type PostRow = typeof posts.$inferSelect;

export function toPublicPost(row: PostRow) {
  const { id, publicId, authorId, categoryId, ...rest } = row;
  void id;
  void authorId;
  void categoryId;
  return { id: publicId, ...rest };
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export async function listPosts(db: DbClient, options: { afterId?: number | null; perPage?: number }) {
  const perPage = Math.min(options.perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const rows = await db
    .select()
    .from(posts)
    .where(options.afterId ? gt(posts.id, options.afterId) : undefined)
    .orderBy(posts.id)
    .limit(perPage + 1);

  const hasMore = rows.length > perPage;
  const page = rows.slice(0, perPage);
  // nextId stays internal — it is the cursor input, and encodeCursor() opaques it.
  return { items: page.map(toPublicPost), nextId: hasMore ? page[page.length - 1].id : null };
}

// Internal: keeps the integer id the update/delete/transition WHERE clauses need.
async function findPostRow(db: DbClient, publicId: string): Promise<PostRow> {
  const [post] = await db.select().from(posts).where(eq(posts.publicId, publicId)).limit(1);
  if (!post) throw new NotFoundError("記事が見つかりません。");
  return post;
}

export async function getPostByPublicId(db: DbClient, publicId: string) {
  return toPublicPost(await findPostRow(db, publicId));
}

export async function createPost(db: DbClient, input: CreatePostInput, session: Session) {
  const now = new Date().toISOString();
  const [post] = await db
    .insert(posts)
    .values({
      publicId: ulid(),
      authorId: session.adminUserId,
      categoryId: input.categoryId ?? null,
      title: input.title,
      slug: input.slug,
      body: input.body,
      status: "draft",
      updatedAt: now,
    })
    .returning();
  return toPublicPost(post!);
}

export async function updatePost(db: DbClient, publicId: string, input: UpdatePostInput) {
  const post = await findPostRow(db, publicId);
  const [updated] = await db
    .update(posts)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(posts.id, post.id))
    .returning();
  return toPublicPost(updated!);
}

export async function deletePost(db: DbClient, publicId: string): Promise<void> {
  const post = await findPostRow(db, publicId);
  await db.delete(posts).where(eq(posts.id, post.id));
}

// Single transition function per DEV-01 §4「状態遷移の集約」— status is never updated by any
// other function in this file.
export async function transitionPost(db: DbClient, publicId: string, to: PostStatus, session: Session) {
  const post = await findPostRow(db, publicId);
  const from = post.status;

  if (!allowedTransitions(from).includes(to)) {
    throw new InvalidStateTransitionError("Post", from, to);
  }

  const now = new Date().toISOString();
  // Status update and audit log land in one transaction (DEV-05 §3, DEV-09 §3-3).
  const [updatedRows] = await db.batch([
    db
      .update(posts)
      .set({
        status: to,
        publishedAt: to === "published" ? (post.publishedAt ?? now) : post.publishedAt,
        updatedAt: now,
      })
      .where(eq(posts.id, post.id))
      .returning(),
    activityLogInsert(db, {
      logName: "content",
      description: `Post ${from} -> ${to}`,
      subjectType: "Post",
      subjectId: post.id,
      event: `post.${to}`,
      causerId: session.adminUserId,
      properties: { from, to },
    }),
  ]);

  return toPublicPost(updatedRows[0]!);
}
