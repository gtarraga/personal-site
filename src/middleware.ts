import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Proxy requests to PostHog static assets
  if (pathname.startsWith("/relay/static/")) {
    const path = pathname.replace("/relay/static/", "");
    const targetUrl = `https://eu-assets.i.posthog.com/static/${path}`;

    try {
      const response = await fetch(targetUrl);

      // Create new headers without compression-related headers
      // (fetch already decompressed the body)
      const headers = new Headers(response.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      headers.delete("transfer-encoding");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    } catch (error) {
      console.error("PostHog static proxy error:", error);
      return new Response("Proxy error", { status: 502 });
    }
  }

  // Proxy requests to PostHog API
  if (pathname.startsWith("/relay/")) {
    const path = pathname.replace("/relay/", "");
    const targetUrl = `https://eu.i.posthog.com/${path}${context.url.search}`;

    try {
      const response = await fetch(targetUrl, {
        method: context.request.method,
        headers: context.request.headers,
        body:
          context.request.method !== "GET" && context.request.method !== "HEAD"
            ? await context.request.clone().text()
            : undefined,
      });

      // Create new headers without compression-related headers
      // (fetch already decompressed the body)
      const headers = new Headers(response.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      headers.delete("transfer-encoding");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    } catch (error) {
      console.error("PostHog API proxy error:", error);
      return new Response("Proxy error", { status: 502 });
    }
  }

  // Continue with normal request handling
  return next();
});
