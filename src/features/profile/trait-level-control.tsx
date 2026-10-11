"use client";

import { useState } from "react";
import type { ProfileInsight, TraitLevel } from "@/types/cognitive";
import { isTraitLevel, TRAIT_LEVEL_DETAILS } from "@/lib/profile/questionnaire";

export function TraitLevelControl({ item, onSave }: { item: ProfileInsight; onSave: (id: string, level: TraitLevel) => boolean | null }) {
  const [message, setMessage] = useState("");
  return <div className="trait-level-control">
    <label htmlFor={"current-level-" + item.id}>当前档位 · 由你自评
      <select id={"current-level-" + item.id} value={item.currentLevel ?? "unknown"} onChange={(event) => {
        const value = event.target.value;
        if (isTraitLevel(value)) setMessage(onSave(item.id, value) ? "当前自评已保存，目标保持原样。" : "保存失败，请查看页面提示。");
      }}>
        {Object.entries(TRAIT_LEVEL_DETAILS).map(([value, details]) => <option key={value} value={value}>{details.label}</option>)}
      </select>
    </label>
    <p>概括近期行为；修改自评会保留原问卷答案，不代表能力分数。</p>
    {message && <p role="status">{message}</p>}
  </div>;
}
