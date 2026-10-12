import type { EvidenceReference, ProfileInsight, UserGoal } from "../../types/cognitive.ts";
import type { Conversation } from "./store.ts";
import type { ChatContextSelection } from "./context.ts";
import { usableProfileInsights } from "../profile/usable.ts";

interface SavedReference {
  id: string;
  fingerprint: string;
  terms: string[];
  topics: string[];
  semanticMatched?: boolean;
}

export interface ChatReferenceRecord {
  version: 1;
  sourceMessageId: string;
  requestedAt: string;
  querySource: "question" | "recent_user_messages";
  retrievalMethod: "keyword" | "hybrid";
  insights: (SavedReference & { evidenceFingerprints: string[] })[];
  goals: SavedReference[];
  omittedByBudget: number;
  settings: { background: boolean; instructions: boolean; responsePreferences: boolean };
  profileExcludedByRequest?: boolean;
  backgroundExcludedByRequest?: boolean;
  retrievalFallback?: boolean;
}

// A change-detection checksum, not an authentication or encryption mechanism.
// Keeping only IDs and checksums prevents traces from retaining deleted personal text.
function fingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  const text = JSON.stringify(value);
  for (let index = 0; index < text.length; index++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(index))) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function evidenceFingerprint(source: EvidenceReference): string {
  return fingerprint(source.kind === "questionnaire"
    ? { kind: "questionnaire", questionId: source.questionId, answer: source.answer, version: source.version, answeredAt: source.answeredAt, excerpt: source.excerpt }
    : { kind: "chat", conversationId: source.conversationId, messageId: source.messageId, excerpt: source.excerpt });
}

function insightFingerprint(item: ProfileInsight): string {
  return fingerprint({ dimension: item.dimension, statement: item.statement, origin: item.origin, status: item.status,
    scope: item.scope ?? null, responseAdaptation: item.responseAdaptation ?? "medium", currentLevel: item.currentLevel ?? null,
    evidence: item.evidence.map(evidenceFingerprint) });
}

function goalFingerprint(item: UserGoal): string {
  return fingerprint({ dimension: item.dimension, intention: item.intention, status: item.status,
    willingness: item.willingness ?? null, targetLevel: item.targetLevel ?? null });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}
function checksum(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{16}$/.test(value);
}
function labels(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 3 && value.every(text);
}
function isReference(value: unknown, insight: boolean): boolean {
  return record(value) && Object.keys(value).every((key) => ["id", "fingerprint", "terms", "topics", "semanticMatched", ...(insight ? ["evidenceFingerprints"] : [])].includes(key)) &&
    text(value.id) && checksum(value.fingerprint) && labels(value.terms) && labels(value.topics) &&
    (value.semanticMatched === undefined || typeof value.semanticMatched === "boolean") &&
    (!insight || (Array.isArray(value.evidenceFingerprints) && value.evidenceFingerprints.length >= 1 && value.evidenceFingerprints.length <= 5 && value.evidenceFingerprints.every(checksum)));
}

export function isChatReferenceRecord(value: unknown): value is ChatReferenceRecord {
  if (!record(value) || !Object.keys(value).every((key) => ["version", "sourceMessageId", "requestedAt", "querySource", "retrievalMethod", "insights", "goals", "omittedByBudget", "settings", "profileExcludedByRequest", "backgroundExcludedByRequest", "retrievalFallback"].includes(key))) return false;
  const settings = value.settings;
  return value.version === 1 && text(value.sourceMessageId) && text(value.requestedAt) && !Number.isNaN(Date.parse(value.requestedAt)) &&
    (value.querySource === "question" || value.querySource === "recent_user_messages") &&
    (value.retrievalMethod === "keyword" || value.retrievalMethod === "hybrid") &&
    Array.isArray(value.insights) && value.insights.length <= 5 && value.insights.every((item) => isReference(item, true)) &&
    new Set(value.insights.map((item) => item.id)).size === value.insights.length &&
    Array.isArray(value.goals) && value.goals.length <= 2 && value.goals.every((item) => isReference(item, false)) &&
    new Set(value.goals.map((item) => item.id)).size === value.goals.length &&
    typeof value.omittedByBudget === "number" && Number.isSafeInteger(value.omittedByBudget) && value.omittedByBudget >= 0 &&
    record(settings) && Object.keys(settings).every((key) => ["background", "instructions", "responsePreferences"].includes(key)) &&
    ["background", "instructions", "responsePreferences"].every((key) => typeof settings[key] === "boolean") &&
    ["profileExcludedByRequest", "backgroundExcludedByRequest", "retrievalFallback"].every((key) => value[key] === undefined || typeof value[key] === "boolean");
}

export function createChatReferences(selection: ChatContextSelection, sourceMessageId: string): ChatReferenceRecord {
  function reason(kind: "insight" | "goal", id: string) {
    const match = selection.reasons.find((item) => item.kind === kind && item.id === id);
    return { terms: (match?.terms ?? []).filter((item) => item.trim()).slice(0, 3).map((item) => item.slice(0, 100)),
      topics: (match?.topics ?? []).filter((item) => item.trim()).slice(0, 3).map((item) => item.slice(0, 100)),
      ...(match?.semanticSimilarity !== undefined || match?.semanticMatched ? { semanticMatched: true } : {}) };
  }
  return {
    version: 1, sourceMessageId, requestedAt: new Date().toISOString(), querySource: selection.querySource,
    retrievalMethod: selection.retrieval?.method ?? "keyword",
    insights: selection.insights.map((item) => ({ id: item.id, fingerprint: insightFingerprint(item),
      evidenceFingerprints: item.evidence.map(evidenceFingerprint), ...reason("insight", item.id) })),
    goals: selection.goals.map((item) => ({ id: item.id, fingerprint: goalFingerprint(item), ...reason("goal", item.id) })),
    omittedByBudget: selection.omittedByBudget,
    settings: { background: !!selection.personalContext?.background, instructions: !!selection.personalContext?.instructions, responsePreferences: !!selection.preferences },
    ...(selection.profileExcludedByRequest !== undefined ? { profileExcludedByRequest: selection.profileExcludedByRequest } : {}),
    ...(selection.backgroundExcludedByRequest !== undefined ? { backgroundExcludedByRequest: selection.backgroundExcludedByRequest } : {}),
    ...(selection.retrieval?.fallbackReason ? { retrievalFallback: true } : {}),
  };
}

export function resolveChatReferences(references: ChatReferenceRecord, insights: ProfileInsight[], goals: UserGoal[], conversations: Conversation[]) {
  const available = references.insights.length ? usableProfileInsights(insights, conversations) : [];
  const selectedInsights: ProfileInsight[] = [];
  const selectedGoals: UserGoal[] = [];
  for (const reference of references.insights) {
    const current = available.find((item) => item.id === reference.id);
    if (!current) continue;
    const evidence = reference.evidenceFingerprints.map((hash) => current.evidence.find((source) => evidenceFingerprint(source) === hash));
    if (evidence.some((source) => source === undefined)) continue;
    const selected = { ...current, evidence: evidence as EvidenceReference[] };
    if (insightFingerprint(selected) === reference.fingerprint) selectedInsights.push(selected);
  }
  for (const reference of references.goals) {
    const current = goals.find((item) => item.id === reference.id && item.status === "active");
    if (current && goalFingerprint(current) === reference.fingerprint) selectedGoals.push({ ...current });
  }
  const selection: ChatContextSelection = {
    insights: selectedInsights, goals: selectedGoals, characters: 0, omittedByBudget: references.omittedByBudget,
    querySource: references.querySource,
    reasons: [...references.insights.map((item) => ({ kind: "insight" as const, id: item.id, terms: item.terms, topics: item.topics, semanticMatched: item.semanticMatched })),
      ...references.goals.map((item) => ({ kind: "goal" as const, id: item.id, terms: item.terms, topics: item.topics, semanticMatched: item.semanticMatched }))],
    retrieval: { method: references.retrievalMethod, ...(references.retrievalFallback ? { fallbackReason: "当时语义检索不可用，使用了关键词检索。" } : {}) },
    profileExcludedByRequest: references.profileExcludedByRequest,
    backgroundExcludedByRequest: references.backgroundExcludedByRequest,
  };
  return { selection, unavailableCount: references.insights.length + references.goals.length - selectedInsights.length - selectedGoals.length };
}
