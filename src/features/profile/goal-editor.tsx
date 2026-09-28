"use client";

import { useState, type FormEvent } from "react";
import type { CognitiveDimension, UserGoal } from "@/types/cognitive";

export function GoalEditor({
  dimension,
  goal,
  onSave,
  onPause,
  onResume,
  onDelete,
}: {
  dimension: CognitiveDimension;
  goal: UserGoal | undefined;
  onSave: (dimension: CognitiveDimension, intention: string) => UserGoal | null;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onSave(dimension, draft)) {
      setEditing(false);
      setDraft("");
      setSaved(true);
    }
  }

  function remove() {
    if (goal && window.confirm("删除这个目标？此操作无法撤销。")) {
      onDelete(goal.id);
      setSaved(false);
    }
  }

  return (
    <div className="goal-editor">
      <h3>我希望的方向</h3>
      <p className="goal-editor-note">这是你自己设定的目标，不会改写当前画像；启用后会随聊天发送给 DeepSeek。</p>
      {goal ? (
        <p className="goal-intention">
          <span>{goal.status === "active" ? "使用中" : "已暂停"}</span>
          {goal.intention}
        </p>
      ) : <p className="goal-empty">尚未设置目标。</p>}
      {editing ? (
        <form onSubmit={save} className="profile-edit-form">
          <label htmlFor={`goal-${dimension}`}>写下你希望在这方面怎么做</label>
          <textarea
            id={`goal-${dimension}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="例如：遇到新任务时先明确优先级"
            maxLength={500}
          />
          <div className="profile-actions">
            <button type="submit" disabled={!draft.trim()}>保存目标</button>
            <button type="button" onClick={() => setEditing(false)}>取消</button>
          </div>
        </form>
      ) : (
        <div className="profile-actions">
          <button type="button" onClick={() => { setDraft(goal?.intention ?? ""); setEditing(true); setSaved(false); }}>
            {goal ? "修改目标" : "设置目标"}
          </button>
          {goal?.status === "active" && <button type="button" onClick={() => onPause(goal.id)}>暂停</button>}
          {goal?.status === "paused" && <button type="button" onClick={() => onResume(goal.id)}>启用</button>}
          {goal && <button type="button" onClick={remove}>删除目标</button>}
        </div>
      )}
      {saved && <p className="goal-editor-note" role="status">目标已保存；启用后会用于后续对话。</p>}
    </div>
  );
}
