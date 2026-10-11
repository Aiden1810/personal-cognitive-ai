import { parseCloudSnapshot, type CloudSnapshot } from "../cloud/snapshot.ts";

export const MAX_LOCAL_BACKUP_BYTES = 5_000_000;

export interface BackupSummary {
  conversations: number;
  messages: number;
  insights: number;
  goals: number;
  outcomes: number;
}

export function summarizeBackup(snapshot: CloudSnapshot): BackupSummary {
  return {
    conversations: snapshot.chat.conversations.length,
    messages: snapshot.chat.conversations.reduce((count, conversation) => count + conversation.messages.length, 0),
    insights: snapshot.profile.insights.length,
    goals: snapshot.goals.goals.length,
    outcomes: snapshot.outcomes.entries.length,
  };
}

export function serializeLocalBackup(snapshot: CloudSnapshot): string {
  const text = JSON.stringify(parseCloudSnapshot(snapshot), null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_LOCAL_BACKUP_BYTES) {
    throw new Error("本地备份超过 5 MB 上限，请先整理资料。");
  }
  return text;
}

export function prepareLocalBackup(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_LOCAL_BACKUP_BYTES) {
    throw new Error("备份文件超过 5 MB 上限，未修改本地资料。");
  }
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/u, "")); }
  catch { throw new Error("无法读取 JSON 备份，未修改本地资料。"); }
  const snapshot = parseCloudSnapshot(value);
  return { snapshot, summary: summarizeBackup(snapshot) };
}
