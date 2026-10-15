export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string; }

export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  D1?: D1Database;
  R2?: R2Bucket;
  Browser?: Fetcher;
  metadata?: { id: string; tag: string };
  AI_Search?: unknown;
  AI_Search_2?: unknown;
  Service?: Fetcher;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}
