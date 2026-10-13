import type { ChatRequest } from "./chat-api.ts";

export interface AgentRequest extends Omit<ChatRequest, "messages"> { task: string; requestId: string; }
export interface SearchPlan { objective: string; queries: string[]; criteria: string[]; }
export interface AgentResource { url: string; title: string; excerpt: string; visitedAt: string; }
export interface AgentEvent { sequence: number; kind: "start" | "search" | "browse" | "extract" | "result"; message: string; url: string | null; title: string | null; at: string; }
export interface AgentJob {
  id: string;
  task: string;
  status: "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled";
  plan: SearchPlan; events: AgentEvent[]; resources: AgentResource[];
  createdAt: string; finishedAt: string | null; error: string | null;
}
export type AgentPhase = "planning" | "browsing" | "summarizing" | "cancelling" | "completed" | "failed" | "cancelled";
export interface AgentProgress { phase: AgentPhase; job?: AgentJob; }
