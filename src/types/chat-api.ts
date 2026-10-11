import type { ProfileInsight, UserGoal } from "./cognitive.ts";
import type { PersonalContext, ResponsePreferences } from "../lib/preferences/store.ts";

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessageInput[];
  insights: ProfileInsight[];
  goals: UserGoal[];
  preferences?: ResponsePreferences;
  personalContext?: PersonalContext;
}

export const CHAT_API_ERROR_CODES = ["VALIDATION_ERROR", "LLM_UNAVAILABLE", "INVALID_MODEL_OUTPUT", "FORBIDDEN", "INTERNAL_ERROR"] as const;
export type ChatApiErrorCode = (typeof CHAT_API_ERROR_CODES)[number];
export type ChatModelErrorCode = Extract<ChatApiErrorCode, "VALIDATION_ERROR" | "LLM_UNAVAILABLE" | "INVALID_MODEL_OUTPUT">;

export type ChatResponse =
  | { ok: true; data: { reply: string } }
  | { ok: false; error: { code: ChatApiErrorCode; message: string } };
