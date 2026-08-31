import { defineMiddleware } from "astro:middleware";

// Security headers only (DEV-01 §5-3, DEV-05 §2). Authentication is deliberately NOT done here:
// each API route / page checks the session at the top of its own handler, because there is no
// framework-provided middleware stack to hang authorization off (DEV-04 §2).
//
// If this admin app must stay out of search engines, add `X-Robots-Tag: noindex, nofollow` below
// (PRD-02 §5). CSP belongs in astro.config.mjs, not here.
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
});
