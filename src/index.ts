import type { Env } from "./types";
import { chatRoute } from "./routes/chat";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, app: "miniprogram", host: url.hostname });
    }
    if (url.pathname === "/api/chat") return chatRoute(request, env);

    // Same Worker can serve both hostnames. The main domain opens index.html;
    // the AI subdomain opens ai.html without changing the URL path.
    if (url.pathname === "/" && url.hostname.toLowerCase() === "ai.flighttripvisa.site") {
      return env.ASSETS.fetch(new Request(new URL("/ai.html", url), request));
    }
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
