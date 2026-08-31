import { defineMiddleware } from "astro:middleware";

// Security headers only (DEV-01 §5-3). The public site has no authenticated routes today; if the
// project adopts the member area (FG-07), its session checks go in the route handlers, not here —
// AdminUser and Member auth stay completely separate code paths (DEV-02 §1-2).
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
});
