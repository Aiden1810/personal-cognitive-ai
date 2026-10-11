"use client";

import { useState, type FormEvent } from "react";
import { GOAL_WILLINGNESS_LEVELS, type CognitiveDimension, type GoalWillingness, type UserGoal, type TraitDimension, type TraitLevel } from "@/types/cognitive";
import { GOAL_WILLINGNESS_DETAILS } from "@/lib/goals/willingness";
import { isTraitDimension, isTraitLevel, TRAIT_LEVEL_DETAILS } from "@/lib/profile/questionnaire";

const TRAIT_GOAL_PROMPTS: Record<TraitDimension, { label: string; placeholder: string }> = {
  action_execution: {
    label: "你希望怎样开始并继续行动？",
    placeholder: "例如：任务明确后先动手做一个小步骤，中断后记下下一步并继续。",
  },
  planning: {
    label: "你希望怎样拆分任务、安排先后？",
    placeholder: "例如：开始任务前拆成三个小步骤，标明先后顺序和每一步的完成标准。",
  },
  time_management: {
    label: "你希望怎样估计用时、预留余量？",
    placeholder: "例如：先估计每项任务的用时，并在截止前留出检查和处理意外的时间。",
  },
  reflection: {
    label: "你希望怎样复盘并调整做法？",
    placeholder: "例如：每次完成任务后记下一个有效做法和一个问题，下次尝试一项调整。",
  },
  exploration: {
    label: "你希望怎样尝试并判断新方法？",
    placeholder: "例如：旧方法效果不理想时，选一种新方法小范围试用，再决定是否继续。",
  },
};

export function GoalEditor({ dimension, goal, onSave, onPause, onResume, onDelete, startEditing = false, onClose, initialIntention, idPrefix, saveLabel = "保存", heading = "我的目标" }: {
  dimension: CognitiveDimension;
  goal: UserGoal | undefined;
  onSave: (dimension: CognitiveDimension, intention: string, willingness?: GoalWillingness | null, targetLevel?: TraitLevel | null) => UserGoal | null;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  startEditing?: boolean;
  onClose?: () => void;
  initialIntention?: string;
  idPrefix?: string;
  saveLabel?: string;
  heading?: string;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(startEditing ? initialIntention ?? goal?.intention ?? "" : "");
  const [willingness, setWillingness] = useState<GoalWillingness | null>(startEditing ? goal?.willingness ?? null : null);
  const [saved, setSaved] = useState(false);
  const [targetLevel, setTargetLevel] = useState<TraitLevel | "">(startEditing ? goal?.targetLevel ?? "" : "");
  const fieldId = idPrefix ?? "goal-" + dimension;
  const prompt = isTraitDimension(dimension) ? TRAIT_GOAL_PROMPTS[dimension] : {
    label: "你希望在这方面怎么做？",
    placeholder: "写下你希望保持或改变的具体做法，以及准备怎样尝试。",
  };

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onSave(dimension, draft, willingness, isTraitDimension(dimension) ? targetLevel || null : undefined)) {
      setEditing(false); setDraft(""); setSaved(true); onClose?.();
    }
  }

  function remove() {
    if (goal && window.confirm("删除这个目标？此操作无法撤销。")) {
      onDelete(goal.id); setSaved(false);
    }
  }

  return (
    <div className="goal-editor">
      <h3>{heading}</h3>
      {editing ? <form onSubmit={save} className="profile-edit-form">
        <label htmlFor={fieldId}>{prompt.label}</label>
        <textarea id={fieldId} value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder={prompt.placeholder} maxLength={500} required />
        {isTraitDimension(dimension) && <label htmlFor={fieldId + "-level"}>希望达到的档位 · 可选
          <select id={fieldId + "-level"} value={targetLevel} onChange={(event) => {
            const value = event.target.value; if (value === "" || isTraitLevel(value)) setTargetLevel(value);
          }}>
            <option value="">不设置档位，使用文字目标</option>
            {Object.entries(TRAIT_LEVEL_DETAILS).map(([value, details]) => <option key={value} value={value}>{details.label}</option>)}
          </select>
          <small>可以希望增加、保持或减少；目标档位不会改写当前自评。</small>
        </label>}
        <fieldset className="goal-willingness">
          <legend>改变意愿<span>可选</span></legend>
          <div className="goal-willingness-options">
            {GOAL_WILLINGNESS_LEVELS.map((level) => <label key={level} className={willingness === level ? "is-selected" : undefined}>
              <input type="radio" name={"willingness-" + fieldId} checked={willingness === level} onChange={() => setWillingness(level)} />
              <strong>{GOAL_WILLINGNESS_DETAILS[level].label}</strong>
            </label>)}
          </div>
          <button type="button" className="text-button goal-willingness-clear" disabled={willingness === null} onClick={() => setWillingness(null)}>不设置意愿</button>
        </fieldset>
        <div className="profile-actions">
          <button type="submit" disabled={!draft.trim()}>{saveLabel}</button>
          <button type="button" onClick={() => { setEditing(false); onClose?.(); }}>取消</button>
        </div>
      </form> : <>
        {goal ? <div className="goal-summary">
          <p className="goal-intention"><span>{goal.status === "active" ? "已启用" : "已暂停"}</span>{goal.intention}</p>
          {goal.willingness && <p className="goal-willingness-summary">改变意愿 · <strong>{GOAL_WILLINGNESS_DETAILS[goal.willingness].label}</strong></p>}
          {goal.targetLevel && <p className="goal-willingness-summary">目标档位 · <strong>{TRAIT_LEVEL_DETAILS[goal.targetLevel].label}</strong></p>}
        </div> : <p className="goal-empty">尚未设置目标。</p>}
        <div className="profile-actions">
          <button type="button" onClick={() => {
            setDraft(goal?.intention ?? ""); setWillingness(goal?.willingness ?? null); setTargetLevel(goal?.targetLevel ?? ""); setEditing(true); setSaved(false);
          }}>{goal ? "修改目标" : "设置目标"}</button>
          {goal && <>
            <button type="button" onClick={() => { if (goal.status === "active") onPause(goal.id); else onResume(goal.id); setSaved(false); }}>{goal.status === "active" ? "暂停" : "启用"}</button>
            <button type="button" onClick={remove}>删除</button>
          </>}
        </div>
      </>}
      {saved && <p className="simple-note" role="status">{goal?.status === "paused" ? "已保存，仍保持暂停。" : "已保存。"}</p>}
    </div>
  );
}
