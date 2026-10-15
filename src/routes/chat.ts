import type { ChatMessage, Env } from "../types";
import { runChat } from "../services/ai";

export async function chatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  try {
    const body = await request.json() as { messages?: ChatMessage[]; prompt?: string; message?: string };
    let messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      const prompt = (body.prompt ?? body.message ?? "").trim();
      if (prompt) messages = [{ role: "user", content: prompt }];
    }
    if (!messages.length || messages.length > 80) {
      return Response.json({ error: "Send between 1 and 80 messages." }, { status: 400 });
    }
    for (const message of messages) {
      if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") {
        return Response.json({ error: "Invalid chat message format." }, { status: 400 });
      }
    }
    return await runChat(env, messages);
  } catch (error) {
    console.error("/api/chat failed", error);
    return Response.json({ error: "AI request failed. Check Worker AI binding and model availability." }, { status: 500 });
  }
}
