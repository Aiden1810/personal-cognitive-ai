import type { Conversation } from "@/lib/chat/store";
import type { ProfileInsight, ProfileScope } from "@/types/cognitive";
import { PROFILE_SCOPE_DETAILS } from "@/lib/profile/scope";
import { evidenceKey, evidenceDate } from "@/lib/profile/evidence";

export function ProfileRecordInfo({ item, conversations }: { item: ProfileInsight; conversations: Conversation[] }) {
  const details = item.scope ? PROFILE_SCOPE_DETAILS[item.scope] : null;
  const fromQuestionnaire = item.evidence.some((source) => source.kind === "questionnaire");
  const sourceIds = new Set(item.evidence.map(evidenceKey));
  const dates = item.evidence.map((source) => evidenceDate(source, conversations))
    .filter((date): date is string => !!date && !Number.isNaN(Date.parse(date))).sort();
  return <div className="profile-record-info">
    <span>{details?.label ?? "范围未标注"}</span>
    <small>{sourceIds.size} 条{fromQuestionnaire ? "问卷回答" : "用户发言"}作为依据{dates.length > 0 ? ` · 最近记录 ${new Date(dates.at(-1)!).toLocaleDateString("zh-CN")}` : ""}</small>
    {fromQuestionnaire && <p>问卷版本 1 · 用户近期自述，可重新填写或归档；不代表稳定人格或测量结果。</p>}
    <p>{details?.note ?? "旧记录尚未区分一次经历、近期状态或自述习惯，可修改并重新审核。"}</p>
  </div>;
}

export function ProfileScopeField({ value, onChange }: { value: ProfileScope | ""; onChange: (value: ProfileScope | "") => void }) {
  return <label>这条记录描述什么？
    <select value={value} onChange={(event) => onChange(event.target.value as ProfileScope | "")}>
      <option value="">暂不确定范围</option>
      {Object.entries(PROFILE_SCOPE_DETAILS).map(([key, details]) => <option key={key} value={key}>{details.label}</option>)}
    </select>
  </label>;
}
