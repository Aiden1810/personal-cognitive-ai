import type { ChatContextSelection } from "@/lib/chat/context";
import type { Conversation } from "@/lib/chat/store";
import type { ProfileInsight, UserGoal } from "@/types/cognitive";
import { PROFILE_DIMENSIONS } from "@/lib/profile/overview";
import { describeResponsePreferences } from "@/lib/preferences/store";
import { PROFILE_SCOPE_DETAILS } from "@/lib/profile/scope";
import { RESPONSE_ADAPTATION_DETAILS } from "@/lib/profile/adaptation";
import { evidenceKey, evidenceTitle } from "@/lib/profile/evidence";
import { TRAIT_LEVEL_DETAILS } from "@/lib/profile/questionnaire";
import type { ChatReferenceRecord } from "@/lib/chat/references";
import { evidenceDate } from "@/lib/profile/evidence";

export type ContextRequestPhase = "pending" | "complete" | "failed";

export function ChatContextPanel({ selection, phase, question, conversations, currentInsights, currentGoals, initiallyOpen = false, referenceRecord, unavailableCount = 0 }: {
  selection: ChatContextSelection;
  phase: ContextRequestPhase;
  question: string;
  conversations: Conversation[];
  currentInsights: ProfileInsight[];
  currentGoals: UserGoal[];
  initiallyOpen?: boolean;
  referenceRecord?: ChatReferenceRecord;
  unavailableCount?: number;
}) {
  function reason(kind: "insight" | "goal", id: string): string {
    const match = selection.reasons.find((item) => item.kind === kind && item.id === id);
    if (!match) return "与提问有关";
    const lexical = match.topics.length ? `关联主题：${match.topics.join("、")}` :
      match.terms.length ? `与提问中的“${match.terms.join("、")}”有关` : "";
    return [lexical, match.semanticMatched || match.semanticSimilarity !== undefined ? "语义相似度达到实验阈值（不代表事实置信度）" : ""].filter(Boolean).join("；") || "与提问有关";
  }
  const status = phase === "pending" ? "正在请求" : phase === "complete" ? "已收到回复" : "请求未完成";
  const insightCount = referenceRecord?.insights.length ?? selection.insights.length;
  const goalCount = referenceRecord?.goals.length ?? selection.goals.length;
  const empty = insightCount === 0 && goalCount === 0;
  const settings = referenceRecord?.settings;

  return (
    <details className={`chat-context-panel${referenceRecord ? " chat-reply-references" : ""}`} open={initiallyOpen ? true : undefined}>
      <summary>
        <span>本次参考资料<small>{empty ? "未附加长期记忆" : `${insightCount} 条记忆 · ${goalCount} 项目标`}</small></span>
        {!referenceRecord && <span className={`chat-context-status is-${phase}`}>{status}</span>}
      </summary>
      <div className="chat-context-body">
        <p className="chat-context-question">对应提问：{question.length > 120 ? `${question.slice(0, 120)}…` : question}</p>
        <p className="chat-context-note">
          {selection.querySource === "recent_user_messages" ? "这是一条追问，筛选时也参考了最近用户发言。" : "按这次提问选择相关资料。"}
          {phase === "failed" ? " 请求未完成，不能确认模型已使用这些资料。" : " 这里展示请求附带的资料，不代表模型一定采纳。"}
        </p>
        {referenceRecord && <p className="chat-context-note">记录于 {new Date(referenceRecord.requestedAt).toLocaleString("zh-CN")}</p>}
        {unavailableCount > 0 && <p className="chat-context-note">当时附加的 {unavailableCount} 项资料已修改、停用、删除或来源失效，内容不再展示。</p>}
        {settings && (settings.background || settings.instructions || settings.responsePreferences) && <p className="chat-context-note">当时另附加了{[settings.background && "个人背景", settings.instructions && "自定义回答要求", settings.responsePreferences && "快捷回答偏好"].filter(Boolean).join("、")}。</p>}
        {selection.profileExcludedByRequest && <p className="chat-context-note">按本次“不参考画像”的要求，没有附加长期画像；相关启用目标仍单独筛选。</p>}
        {selection.preferences && <p className="chat-context-note">本次回答偏好：{describeResponsePreferences(selection.preferences)}。由你设置，与画像检索分开应用。</p>}
        <details className="simple-more"><summary>匹配说明</summary><p className="chat-context-note">本次检索：{selection.retrieval?.method === "hybrid" ? "关键词＋本地语义向量（实验）" : "关键词与有限主题匹配"}。{selection.retrieval?.fallbackReason}</p></details>
        {selection.backgroundExcludedByRequest && <p className="chat-context-note">按本次要求，没有附加个人背景；自定义回答要求仍单独应用。</p>}
        {selection.personalContext && <details className="chat-personal-context"><summary>本次个人设置 · 由你填写</summary>
          {selection.personalContext.background && <><strong>个人背景</strong><p>{selection.personalContext.background}</p></>}
          {selection.personalContext.instructions && <><strong>自定义回答要求</strong><p>{selection.personalContext.instructions}</p></>}
          <small>保存于 {new Date(selection.personalContext.updatedAt).toLocaleString("zh-CN")}；展示的是本次请求附带的设置。</small>
        </details>}
        {empty && <p className="chat-context-empty">本次没有附加画像或目标{referenceRecord ? "，近期对话仍用于回答。" : selection.personalContext ? "，已附加你开启的个人设置。" : selection.preferences ? "，仍按你的回答偏好发送近期对话。" : "，仅发送近期对话。"}</p>}
        {selection.insights.map((item) => {
          const current = currentInsights.find((current) => current.id === item.id && current.statement === item.statement);
          const level = item.responseAdaptation ?? "medium";
          return (
            <article className="chat-context-entry" key={`insight-${item.id}`}>
              <span className="chat-context-label">已确认画像 · {PROFILE_DIMENSIONS[item.dimension].label}{item.scope ? ` · ${PROFILE_SCOPE_DETAILS[item.scope].label}` : ""}</span>
              {current ? <>
                <p className="chat-context-statement">{item.statement}</p>
                {item.currentLevel && <p className="chat-context-note">当前自评：{TRAIT_LEVEL_DETAILS[item.currentLevel].label}</p>}
                <small>{reason("insight", item.id)}</small>
                <p className="chat-context-note">本次帮助方式：{RESPONSE_ADAPTATION_DETAILS[level].helpLabel} · {RESPONSE_ADAPTATION_DETAILS[level].description}</p>
                {(current.responseAdaptation ?? "medium") !== level && <p className="chat-context-note">当前已改为“{RESPONSE_ADAPTATION_DETAILS[current.responseAdaptation ?? "medium"].label}”，下一次请求生效。</p>}
                {item.evidence.map((source) => (
                  <blockquote key={evidenceKey(source)}>
                    <span>{source.kind === "questionnaire" ? "回答依据" : "原话"}：{source.excerpt}</span>
                    <cite>来自「{evidenceTitle(source, conversations)}」{evidenceDate(source, conversations) ? ` · ${new Date(evidenceDate(source, conversations)!).toLocaleDateString("zh-CN")}` : ""}</cite>
                  </blockquote>
                ))}
              </> : <p className="chat-context-note">原记录已变更、删除或来源失效，不再展示其内容。</p>}
            </article>
          );
        })}
        {selection.goals.map((item) => (
          <article className="chat-context-entry" key={`goal-${item.id}`}>
            <span className="chat-context-label">用户目标 · {PROFILE_DIMENSIONS[item.dimension].label}</span>
            {currentGoals.some((current) => current.id === item.id && current.intention === item.intention) ? <>
              <p className="chat-context-statement">{item.intention}</p>
              {item.targetLevel && <p className="chat-context-note">目标档位：{TRAIT_LEVEL_DETAILS[item.targetLevel].label}，不代表当前状态。</p>}
              <small>{reason("goal", item.id)}</small>
            </> : <p className="chat-context-note">原目标已变更或删除，不再展示其内容。</p>}
          </article>
        ))}
        {selection.omittedByBudget > 0 && <p className="chat-context-note">为控制资料量，另有 {selection.omittedByBudget} 条相关资料未发送。</p>}
        {!empty && <a className="chat-reference-manage" href="/profile">到画像页查看或修改记忆与目标</a>}
      </div>
    </details>
  );
}
