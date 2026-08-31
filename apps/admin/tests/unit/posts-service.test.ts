// D1-backed Service test (DEV-05 §2 layer): exercises the real posts Service against a
// migrated, in-workerd D1 database. Seeds an admin_user first to satisfy posts.author_id (FK).
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { createDb, type DbClient } from "../../src/lib/server/db/client";
import { adminUsers } from "@app/schema";
import { ulid } from "@app/schema/ulid";
import { createPost, getPostByPublicId, listPosts, transitionPost } from "../../src/lib/server/services/posts";
import { InvalidStateTransitionError } from "../../src/lib/server/http/errors";
import type { Session } from "../../src/lib/server/auth/session";

let db: DbClient;
let session: Session;

beforeEach(async () => {
  db = createDb(env.DB);
  const now = new Date().toISOString();
  const [admin] = await db
    .insert(adminUsers)
    .values({
      publicId: ulid(),
      name: "Test Admin",
      email: `admin-${ulid()}@example.com`,
      passwordHash: "salt.hash",
      role: "admin",
      status: "active",
      updatedAt: now,
    })
    .returning();
  session = { adminUserId: admin.id, adminUserPublicId: admin.publicId, role: "admin" };
});

describe("posts service (Service -> D1 via Drizzle)", () => {
  it("creates a post as draft and reads it back by public_id", async () => {
    const created = await createPost(db, { title: "Hello", slug: `hello-${ulid()}`, body: "Body", categoryId: null }, session);
    expect(created.status).toBe("draft");
    // The Service returns the public shape: `id` is the ULID public_id, and the internal
    // integer id / authorId / categoryId are not exposed at all (DEV-05 §2, DEV-07 §1).
    expect(created.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(created).not.toHaveProperty("authorId");

    const fetched = await getPostByPublicId(db, created.id);
    expect(fetched.title).toBe("Hello");
  });

  it("lists created posts", async () => {
    await createPost(db, { title: "A", slug: `a-${ulid()}`, body: "x", categoryId: null }, session);
    const { items } = await listPosts(db, {});
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("publishes a draft (sets published_at) and rejects an illegal transition", async () => {
    const post = await createPost(db, { title: "T", slug: `t-${ulid()}`, body: "x", categoryId: null }, session);

    const published = await transitionPost(db, post.id, "published", session);
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeTruthy();

    const draft = await createPost(db, { title: "D", slug: `d-${ulid()}`, body: "x", categoryId: null }, session);
    await expect(transitionPost(db, draft.id, "archived", session)).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });
});
