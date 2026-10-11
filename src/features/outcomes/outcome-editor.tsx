"use client";

import { useState, type FormEvent } from "react";
import type { UserGoal } from "@/types/cognitive";
import type { OutcomeRating } from "@/lib/outcomes/store";

export const OUTCOME_RATING_LABELS: Record<OutcomeRating, string> = {
  toward: "有进展", unclear: "还不确定", away: "偏离目标",
};

export function OutcomeEditor({ goal, initialAction = "", initialResult = "", idPrefix = "outcome", onSave, onCancel }: {
  goal: UserGoal;
  initialAction?: string;
  initialResult?: string;
  idPrefix?: string;
  onSave: (goal: UserGoal, action: string, result: string, rating: OutcomeRating) => boolean;
  onCancel?: () => void;
}) {
  const [action, setAction] = useState(initialAction);
  const [result, setResult] = useState(initialResult);
  const [rating, setRating] = useState<OutcomeRating>("unclear");
  const [saved, setSaved] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onSave(goal, action, result, rating)) {
      setAction(""); setResult(""); setRating("unclear"); setSaved(true);
    }
  }

  return <form onSubmit={save} className="outcome-form">
    <div className="outcome-step">
      <label htmlFor={idPrefix + "-action"}>做了什么？</label>
      <textarea id={idPrefix + "-action"} value={action} onChange={(event) => { setAction(event.target.value); setSaved(false); }} maxLength={500}
        placeholder="例如：先做了 20 分钟复习题" required />
      <label htmlFor={idPrefix + "-result"}>结果如何？</label>
      <textarea id={idPrefix + "-result"} value={result} onChange={(event) => { setResult(event.target.value); setSaved(false); }} maxLength={1000}
        placeholder="写下实际结果，没有提到的结果需要你补充" required />
    </div>
    <fieldset className="outcome-rating">
      <legend>我的评价</legend>
      {(Object.keys(OUTCOME_RATING_LABELS) as OutcomeRating[]).map((value) => <label key={value} className={rating === value ? "is-checked" : ""}>
        <input type="radio" name={idPrefix + "-rating"} value={value} checked={rating === value} onChange={() => setRating(value)} />
        {OUTCOME_RATING_LABELS[value]}
      </label>)}
    </fieldset>
    <div className="profile-actions">
      <button type="submit" className="outcome-save" disabled={!action.trim() || !result.trim()}>{onCancel ? "确认保存行动" : "保存记录"}</button>
      {onCancel && <button type="button" onClick={onCancel}>取消</button>}
    </div>
    {saved && <p className="outcome-saved" role="status">已保存。</p>}
  </form>;
}
