// Response envelope builders matching docs/3-development/04-api-spec.md (DEV-04 §3).
import { AppError, ValidationError } from "./errors";

export function jsonItem(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}

// Cursor-based collection envelope — for the large, high-growth lists DEV-04 §8 calls out
// by name (Post / Inquiry / activity_log). Page-based lists (e.g. admin_users) don't go
// through this helper; add a jsonPageCollection() alongside it if/when one is needed.
export function jsonCursorCollection(data: unknown[], meta: { perPage: number; nextCursor: string | null }): Response {
  return Response.json({
    data,
    meta: { per_page: meta.perPage, next_cursor: meta.nextCursor },
  });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return Response.json({ message: error.message, errors: error.errors, error_code: error.code }, { status: error.status });
  }
  if (error instanceof AppError) {
    return Response.json({ message: error.message, error_code: error.code }, { status: error.status });
  }
  console.error(error);
  return Response.json({ message: "サーバー内部エラーが発生しました。", error_code: "INTERNAL_ERROR" }, { status: 500 });
}
