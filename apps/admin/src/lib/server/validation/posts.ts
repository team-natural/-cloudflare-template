// Zod schemas derived from the Drizzle schema (DEV-01 §2: prefer drizzle-zod over hand-written
// duplicate definitions). `status` is intentionally excluded from both — status changes go
// through transitionPost() (src/lib/server/services/posts.ts), never a direct field update.
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import type { z } from "zod";
import { posts } from "@app/schema";

export const createPostSchema = createInsertSchema(posts, {
  title: (schema) => schema.min(1).max(255),
  slug: (schema) => schema.min(1).max(255),
  body: (schema) => schema.min(1),
}).pick({ title: true, slug: true, body: true, categoryId: true });

export const updatePostSchema = createUpdateSchema(posts, {
  title: (schema) => schema.min(1).max(255),
  slug: (schema) => schema.min(1).max(255),
  body: (schema) => schema.min(1),
}).pick({ title: true, slug: true, body: true, categoryId: true });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
