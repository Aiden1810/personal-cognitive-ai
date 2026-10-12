"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, useRef, ViewTransition } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { TRAIT_DIMENSIONS, type ProfileInsight, type QuestionnaireAnswer } from "@/types/cognitive";
import { useProfileData } from "@/lib/profile/client";
import { ANSWER_DETAILS, TRAIT_DETAILS, TRAIT_LEVEL_DETAILS, QUESTIONNAIRE_QUESTIONS, buildQuestionnaireInsights, isTraitLevel, type QuestionnaireAnswers } from "@/lib/profile/questionnaire";
import { evidenceKey } from "@/lib/profile/evidence";

export function TraitQuestionnaire() {
  const router = useRouter();
  const profile = useProfileData();
  const heading = useRef<HTMLHeadingElement>(null);
  const hasMoved = useRef(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [drafts, setDrafts] = useState<ProfileInsight[]>([]);
  const [included, setIncluded] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const reviewing = step === TRAIT_DIMENSIONS.length;
  const dimension = TRAIT_DIMENSIONS[Math.min(step, TRAIT_DIMENSIONS.length - 1)];
  const questions = QUESTIONNAIRE_QUESTIONS.filter((question) => question.dimension === dimension);
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    if (hasMoved.current) heading.current?.focus();
  }, [step]);

  function move(next: number) {
    hasMoved.current = true;
    startTransition(() => {
      setFormError("");
      if (next === TRAIT_DIMENSIONS.length) {
        const items = buildQuestionnaireInsights(answers, {}, new Date().toISOString());
        setDrafts(items); setIncluded(items.map((item) => item.id));
      }
      setStep(next);
    });
  }

  function save(destination: "/chat" | "/profile") {
    const items = drafts.filter((item) => included.includes(item.id));
    if (items.some((item) => !item.statement.trim())) { setFormError("请补充描述，或取消记住该项。"); return; }
    if (profile.completeQuestionnaire(items.map((item) => ({ ...item, statement: item.statement.trim() })))) router.push(destination);
  }

  function skip() {
    if (profile.skipQuestionnaire()) router.push("/chat");
  }

  function updateDraft(id: string, changes: Partial<Pick<ProfileInsight, "statement" | "currentLevel">>) {
    setDrafts((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  return <section className="trait-questionnaire" aria-labelledby="questionnaire-title">
    <header className="page-heading"><div><p className="questionnaire-kicker">认识你的做事方式</p><h1 id="questionnaire-title">建立初始画像</h1></div><Link className="icon-link" href="/chat">返回对话<ArrowUpRight size={16} aria-hidden="true" /></Link></header>
    {!profile.ready ? <p role="status" className="loading">正在读取资料…</p> : <>
      <p className="questionnaire-intro">回想最近四周的学习或项目经历，选择实际发生的情况。可以跳题；不确定和没有相关经历都不会算作低档。</p>
      <p className="simple-note">确认保存后，相关画像才会供后续 AI 回答参考。问卷在本浏览器整理；聊天读取相关资料时会发送给模型服务。它是近期自述，不是人格测评。</p>
      {profile.state?.onboarding?.status === "completed" && <p className="questionnaire-retake">重新填写后，记住的项目会替换对应旧问卷画像，旧记录归档保留；未选择的项目、聊天记忆和目标保持原样。</p>}
      {(profile.error || formError) && <p className="error-notice" role="alert">{profile.error || formError}</p>}
      <div className="questionnaire-progress" aria-label={`已回答 ${answeredCount} 题，共 15 题`}>
        <progress value={reviewing ? 5 : step} max={5} /><span>{reviewing ? "核对画像" : `第 ${step + 1} 组 / 共 5 组`} · 已回答 {answeredCount}/15</span>
      </div>
      <ViewTransition name="questionnaire-step" update="content-swap">
      <div className="questionnaire-step">
      <h2 ref={heading} tabIndex={-1} className="questionnaire-step-heading">{reviewing ? "这些描述符合现在的你吗" : TRAIT_DETAILS[dimension].label}</h2>
      {reviewing ? <>
        <p className="simple-note">按答案整理的档位只是草稿。请核对、修改描述与档位，再选择要记住的项目。档位概括行为频率，不是能力分数。</p>
        <details className="questionnaire-rules"><summary>档位草稿如何整理？</summary><p>至少两题有“很少／有时／经常”的回答，才建议档位；同档出现两次时建议对应档位。“很少”和“经常”同时出现，或答案没有多数时，保留“随情境变化”。其他情况暂不确定。这是产品整理规则，未经心理测量验证。</p></details>
        {drafts.length === 0 && <p className="questionnaire-empty">目前没有足够的具体自述可保存。可以返回补充，也可以直接开始聊天；五项当前状态保持未知。</p>}
        <div className="questionnaire-review-grid">
          {drafts.map((item) => <article className="questionnaire-review-card" key={item.id}>
            <label className="questionnaire-include"><input type="checkbox" checked={included.includes(item.id)} onChange={(event) => setIncluded((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} /><strong>记住这项 · {TRAIT_DETAILS[item.dimension as typeof dimension].label}</strong></label>
            <label htmlFor={"draft-level-" + item.id}>当前档位 · 请核对<select id={"draft-level-" + item.id} value={item.currentLevel ?? "unknown"} disabled={!included.includes(item.id)} onChange={(event) => { if (isTraitLevel(event.target.value)) updateDraft(item.id, { currentLevel: event.target.value }); }}>
              {Object.entries(TRAIT_LEVEL_DETAILS).map(([value, details]) => <option key={value} value={value}>{details.label}</option>)}
            </select></label>
            <label htmlFor={"draft-statement-" + item.id}>当前情况<textarea id={"draft-statement-" + item.id} value={item.statement} maxLength={500} disabled={!included.includes(item.id)} onChange={(event) => updateDraft(item.id, { statement: event.target.value })} /></label>
            <details><summary>查看问卷依据 · {item.evidence.length} 题</summary>{item.evidence.map((source) => <blockquote key={evidenceKey(source)}>{source.excerpt}</blockquote>)}</details>
          </article>)}
        </div>
        <div className="questionnaire-actions">
          <button type="button" className="button primary" onClick={() => save("/chat")}>确认并开始对话</button>
          <button type="button" className="button secondary" onClick={() => save("/profile")}>确认并设置目标</button>
          <button type="button" className="text-button" onClick={() => move(4)}>返回修改答案</button>
        </div>
      </> : <>
        <p className="simple-note">{TRAIT_DETAILS[dimension].description} 遇到以下情况时，这种行为出现得多频繁？</p>
        <div className="questionnaire-questions">
          {questions.map((question) => <fieldset key={question.id}>
            <legend><span>{question.id.slice(1).padStart(2, "0")}</span>{question.text}</legend>
            <div className="questionnaire-answer-options">
              {Object.entries(ANSWER_DETAILS).map(([value, details]) => <label className={answers[question.id] === value ? "is-selected" : undefined} key={value}>
                <input type="radio" name={question.id} value={value} checked={answers[question.id] === value} onChange={() => setAnswers((current) => ({ ...current, [question.id]: value as QuestionnaireAnswer }))} />
                <strong>{details.label}</strong><small>{details.description}</small>
                {answers[question.id] === value && <Check className="questionnaire-selected-icon" size={14} aria-hidden="true" />}
              </label>)}
            </div>
            {answers[question.id] && <button type="button" className="text-button" onClick={() => setAnswers((current) => { const next = { ...current }; delete next[question.id]; return next; })}>清除选择</button>}
          </fieldset>)}
        </div>
        <div className="questionnaire-actions">
          <button type="button" className="button primary" onClick={() => move(step + 1)}>{step === 4 ? "核对初始画像" : "下一组"}<ArrowRight size={16} aria-hidden="true" /></button>
          {step > 0 && <button type="button" className="button secondary" onClick={() => move(step - 1)}><ArrowLeft size={16} aria-hidden="true" />上一组</button>}
          <button type="button" className="text-button" onClick={skip}>跳过问卷 开始对话</button>
        </div>
      </>}
      </div>
      </ViewTransition>
    </>}
  </section>;
}
