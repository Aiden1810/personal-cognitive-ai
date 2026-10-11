"use client";

import { useId, useState } from "react";
import type { ProfileInsight, ResponseAdaptation } from "@/types/cognitive";
import { isResponseAdaptation, RESPONSE_ADAPTATION_DETAILS } from "@/lib/profile/adaptation";

export function ProfileResponseAdaptation({ item, disabled = false, onSave }: {
  item: ProfileInsight;
  disabled?: boolean;
  onSave: (id: string, level: ResponseAdaptation) => boolean | null;
}) {
  const fieldId = useId();
  const [message, setMessage] = useState<string | null>(null);
  if (item.status !== "confirmed") return null;
  const level = item.responseAdaptation ?? "medium";

  return (
    <details className="profile-response-adaptation">
      <summary>AI 帮助方式 · {RESPONSE_ADAPTATION_DETAILS[level].helpLabel}</summary>
      <div>
        <label htmlFor={fieldId}>这条画像需要多少具体帮助？</label>
        <select id={fieldId} value={level} disabled={disabled} aria-describedby={`${fieldId}-help`}
          onChange={(event) => {
            const next = event.target.value;
            if (!isResponseAdaptation(next)) return;
            setMessage(onSave(item.id, next) ? "已保存；下一次相关提问生效。" : "保存失败，请查看页面提示后重试。");
          }}>
          <option value="low">简要提示 · 直接给要点</option>
          <option value="medium">方法与例子 · 几个可行步骤</option>
          <option value="high">分步指导 · 帮助起步与检查</option>
        </select>
        <p id={`${fieldId}-help`}>{RESPONSE_ADAPTATION_DETAILS[level].description} 只在这条画像与问题相关时使用，当次要求和回答偏好优先。</p>
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
