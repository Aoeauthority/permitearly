const ALLOWED_ORIGINS = new Set([
  "https://permitearly.com",
  "https://www.permitearly.com",
  "https://permitearly.vercel.app",
  "https://bjimnq.readdy.co",
]);

export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : "https://permitearly.com";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-contractor-email, x-stripe-customer-id, x-trigger-secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function corsOptions(requestOrigin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(requestOrigin),
  });
}
