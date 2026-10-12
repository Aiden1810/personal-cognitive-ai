"use client";

import { useState, type FormEvent } from "react";
import { useResponsePreferences } from "@/lib/preferences/client";
import { DEFAULT_RESPONSE_PREFERENCES, describeResponsePreferences, RESPONSE_PREFERENCE_OPTIONS, type ResponsePreferences } from "@/lib/preferences/store";

export function ResponsePreferencePanel({ busy }: { busy: boolean }) {
  const data = useResponsePreferences();
  const [draft, setDraft] = useState<ResponsePreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const values = draft ?? data.state?.preferences ?? DEFAULT_RESPONSE_PREFERENCES;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (data.save(values)) { setDraft(null); setSaved(true); }
  }
  const fields = [
    { key: "length", label: "回答长短" },
    { key: "explanation", label: "解释方式" },
    { key: "structure", label: "回答结构" },
  ] as const;
  return (
    <details className="response-preferences">
      <summary><strong>回答偏好</strong><span>{data.state ? describeResponsePreferences(data.state.preferences) : "读取设置中…"}</span></summary>
      <form onSubmit={submit}>
        <p>保存后，在新对话中也会使用。只调整表达方式；这次提问有不同要求时，以这次要求为准。</p>
        <div className="response-preference-fields">
          {fields.map(({ key, label }) => <label key={key}>{label}
            <select value={values[key]} disabled={!data.ready || busy} onChange={(event) => {
              setDraft({ ...values, [key]: event.target.value } as ResponsePreferences); setSaved(false);
            }}>
              {Object.entries(RESPONSE_PREFERENCE_OPTIONS[key]).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>)}
        </div>
        <div className="profile-actions">
          <button type="submit" disabled={!data.ready || busy || draft === null}>保存回答偏好</button>
          <button type="button" disabled={!data.ready || busy} onClick={() => { setDraft({ ...DEFAULT_RESPONSE_PREFERENCES }); setSaved(false); }}>恢复默认（保存后生效）</button>
        </div>
        {saved && <p role="status">回答偏好已保存，下次发送消息时生效。</p>}
        {data.error && <p className="error-notice" role="alert">{data.error} 请重新保存设置后继续聊天。 <button type="button" className="text-button" onClick={data.retryLoad}>重试读取设置</button></p>}
      </form>
    </details>
  );
}
