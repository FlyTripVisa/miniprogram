
import type { Env } from "./types";
import { chatRoute } from "./routes/chat";

const ALLOWED_ORIGINS = new Set([
  "https://ai.flytripvisa.site",
  "https://ai.flighttripvisa.site",
  "https://miniprogram.flytripvisa.workers.dev",
  "https://flytripvisa.site",
  "https://www.flytripvisa.site",
]);

function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept"
    );
    headers.set("Access-Control-Max-Age", "86400");
  }

  return headers;
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request);

  cors.forEach((value, key) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health") {
      return Response.json({
        ok: true,
        app: "miniprogram",
        host: url.hostname,
      });
    }

    if (path === "/api/chat") {
      const cors = corsHeaders(request);

      if (request.method === "OPTIONS") {
        if (
          request.headers.has("Origin") &&
          !cors.has("Access-Control-Allow-Origin")
        ) {
          return new Response("Origin not allowed", { status: 403 });
        }

        return new Response(null, {
          status: 204,
          headers: cors,
        });
      }

      if (request.method !== "POST") {
        return withCors(
          new Response("Method not allowed", {
            status: 405,
            headers: { Allow: "POST, OPTIONS" },
          }),
          request
        );
      }

      if (
        request.headers.has("Origin") &&
        !cors.has("Access-Control-Allow-Origin")
      ) {
        return new Response("Origin not allowed", { status: 403 });
      }

      try {
        const response = await chatRoute(request, env);
        return withCors(response, request);
      } catch (error) {
        console.error("Chat route failed:", error);

        return withCors(
          Response.json(
            { error: "The AI chat request failed. Please try again." },
            { status: 500 }
          ),
          request
        );
      }
    }

    // Serve ai.html on either spelling of the AI hostname.
    if (
      path === "/" &&
      [
        "ai.flytripvisa.site",
        "ai.flighttripvisa.site",
      ].includes(url.hostname.toLowerCase())
    ) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/ai.html";
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
