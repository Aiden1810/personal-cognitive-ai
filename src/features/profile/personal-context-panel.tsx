"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useResponsePreferences } from "@/lib/preferences/client";
import { MAX_BACKGROUND_CHARACTERS, MAX_CUSTOM_INSTRUCTIONS_CHARACTERS, type PersonalContext, type PersonalContextInput } from "@/lib/preferences/store";

function PersonalContextForm({ context, onSave, onClear }: { context?: PersonalContext; onSave: (input: PersonalContextInput) => void; onClear: () => void }) {
  const [background, setBackground] = useState(context?.background ?? "");
  const [instructions, setInstructions] = useState(context?.instructions ?? "");
  const [enabled, setEnabled] = useState(context?.enabled ?? true);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSave({ background, instructions, enabled }); }
  return <form className="personal-context-form" onSubmit={submit}>
    <div className="personal-context-fields">
      <label htmlFor="personal-background"><strong>希望 AI 了解的背景</strong><span>学校、专业、年级、正在做的事、社会背景，或未来希望发展的方向，都可以自由填写。</span>
        <textarea id="personal-background" value={background} maxLength={MAX_BACKGROUND_CHARACTERS} onChange={(event) => setBackground(event.target.value)} placeholder="例如：我正在学习编程，熟悉基础语法，希望通过小项目积累经验。" />
        <small>{background.length}/{MAX_BACKGROUND_CHARACTERS} 字</small>
      </label>
      <label htmlFor="personal-instructions"><strong>希望 AI 怎么回答</strong><span>讲解顺序、语言、详细程度，或希望它注意的事情。</span>
        <textarea id="personal-instructions" value={instructions} maxLength={MAX_CUSTOM_INSTRUCTIONS_CHARACTERS} onChange={(event) => setInstructions(event.target.value)} placeholder="例如：先解释整体逻辑，再给步骤与例子；发现我的理解有误时直接指出。" />
        <small>{instructions.length}/{MAX_CUSTOM_INSTRUCTIONS_CHARACTERS} 字</small>
      </label>
    </div>
    <label className="personal-context-switch"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />在后续聊天中应用这些设置</label>
    <p className="simple-note">修改后点击保存。开启时，每次聊天会将这些文字发送给模型；停用会保留文字供你修改，清空只删除此处设置，已有对话另行管理。未来方向不会自动创建正式目标。回答要求不能开启尚未提供的联网或外部执行能力。</p>
    <div className="profile-actions"><button type="submit">保存个人设置</button><button type="button" onClick={onClear}>清空背景与要求</button></div>
  </form>;
}

export function PersonalContextPanel() {
  const data = useResponsePreferences();
  const details = useRef<HTMLDetailsElement>(null);
  const [message, setMessage] = useState("");
  const context = data.state?.personalContext;
  useEffect(() => {
    const openFromHash = () => { if (window.location.hash === "#personal-context" && details.current) details.current.open = true; };
    openFromHash(); window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);
  function save(input: PersonalContextInput) {
    setMessage(data.savePersonalContext(input) ? input.enabled ? "已保存；下一次聊天应用。" : "已保存并停用，后续聊天不发送这些文字。" : "保存失败，文字尚未更新。");
  }
  function clear() {
    if (window.confirm("清空已保存的个人背景和回答要求？快捷回答偏好与画像会保留。")) setMessage(data.clearPersonalContext() ? "已清空；后续聊天不再发送这些文字。" : "清空失败，原设置仍保留。");
  }
  return <details id="personal-context" className="profile-tool personal-context-panel" ref={details}>
    <summary><strong>我的背景与回答要求</strong><span>{context ? context.enabled ? "已开启" : "已停用" : "自由填写"}</span></summary>
    {!data.ready && <p role="status">正在读取个人设置…</p>}
    {data.error && <p role="alert" className="error-notice">{data.error} 草稿可保留并重试；资料损坏时可从<Link href="/backup">备份</Link>恢复。 <button type="button" className="text-button" onClick={data.retryLoad}>重试读取设置</button></p>}
    {data.ready && data.state && <PersonalContextForm key={context?.updatedAt ?? "empty"} context={context} onSave={save} onClear={clear} />}
    {message && <p className="personal-context-status" role="status">{message}</p>}
  </details>;
}
