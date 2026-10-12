"use client";

import { useState, type ChangeEvent } from "react";
import { readBrowserSnapshot, restoreBrowserSnapshot } from "@/lib/backup/client";
import { MAX_LOCAL_BACKUP_BYTES, prepareLocalBackup, serializeLocalBackup } from "@/lib/backup/local";
import { describeResponsePreferences } from "@/lib/preferences/store";

export function LocalBackupPanel({ disabled = false }: { disabled?: boolean }) {
  const [prepared, setPrepared] = useState<ReturnType<typeof prepareLocalBackup> | null>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function download() {
    try {
      const text = serializeLocalBackup(readBrowserSnapshot());
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a");
      const date = new Date();
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      link.href = url;
      link.download = `zhiheng-backup-${day}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("备份已下载，请妥善保管。");
      setError(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "下载备份失败。"); }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setPrepared(null); setMessage(null); setError(null); setFileName(file.name);
    if (file.size > MAX_LOCAL_BACKUP_BYTES) { setError("备份文件超过 5 MB 上限，未修改本地资料。"); return; }
    setReading(true);
    try {
      setPrepared(prepareLocalBackup(await file.text()));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "读取备份失败，未修改本地资料。"); }
    finally { setReading(false); }
  }

  function restore() {
    if (!prepared || disabled || reading) return;
    try {
      restoreBrowserSnapshot(prepared.snapshot);
      window.location.reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "恢复失败，未完成写入。"); }
  }

  return (
    <section className="account-card local-backup-panel" aria-labelledby="local-backup-title">
      <h2 id="local-backup-title">备份与恢复</h2>
      <p>保存一份资料文件，换设备时也能恢复。</p>
      <div className="account-actions">
        <button type="button" onClick={download} disabled={disabled || reading}>导出备份</button>
        <label className="local-backup-file">导入备份
          <input type="file" accept=".json,application/json" onChange={(event) => void selectFile(event)} disabled={disabled || reading} aria-label="导入备份文件" />
        </label>
      </div>
      {reading && <p role="status">正在检查备份…</p>}
      {prepared && <div className="local-backup-preview">
        <h3>已校验：{fileName}</h3>
        <p>{prepared.summary.conversations} 段对话 · {prepared.summary.messages} 条消息 · {prepared.summary.insights} 条画像 · {prepared.summary.goals} 个目标 · {prepared.summary.outcomes} 条行动反馈</p>
        {prepared.snapshot.preferences && <details className="simple-more"><summary>回答偏好</summary><p>{describeResponsePreferences(prepared.snapshot.preferences.preferences)}</p></details>}
        <p>恢复会替换当前资料，请先导出备份。恢复后自动整理记忆会关闭。</p>
        <div className="account-actions">
          <button type="button" onClick={restore} disabled={disabled || reading}>确认恢复</button>
          <button type="button" className="account-secondary" onClick={() => { setPrepared(null); setFileName(""); }} disabled={disabled || reading}>取消</button>
        </div>
      </div>}
      {message && <p className="account-status" role="status">{message}</p>}
      {error && <div className="error-notice" role="alert">{error}</div>}
    </section>
  );
}
