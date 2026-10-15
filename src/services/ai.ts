import type { ChatMessage, Env } from "../types";

export const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
export const SYSTEM_PROMPT = `You are Fly AI, the official travel and visa information assistant for FlightTripVisa. Be friendly, concise, and clear. Explain that visa rules and fees can change and should be verified with the destination country's official authority. Never claim to submit a visa application or guarantee approval.`;

export async function runChat(env: Env, inputMessages: ChatMessage[]): Promise<Response> {
  const messages = inputMessages.slice(-40).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 12000)
  }));
  if (!messages.some((m) => m.role === "system")) {
    messages.unshift({ role: "system", content: SYSTEM_PROMPT });
  }
  const result = await env.AI.run(MODEL_ID, {
    messages,
    max_tokens: 1024,
    stream: true
  });
  return new Response(result as ReadableStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
