"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAuthError, isAuthSessionMissingError, type User } from "@supabase/supabase-js";
import { getCloudClient } from "@/lib/cloud/client";
import { snapshotByteLength } from "@/lib/cloud/snapshot";
import { readBrowserSnapshot, restoreBrowserSnapshot } from "@/lib/backup/client";
import { LocalBackupPanel } from "./local-backup-panel";

const supabase = getCloudClient();

function authFailureMessage(failure: unknown): string {
  if (isAuthError(failure)) {
    if (failure.code === "email_not_confirmed") return "邮箱尚未验证。请打开最新的确认邮件，点击验证链接后回到这里登录。";
    if (failure.code === "invalid_credentials") return "邮箱或密码不正确，请检查后重试；已经注册过的账户无需重新创建。";
    if (failure.code === "over_email_send_rate_limit" || failure.code === "over_request_rate_limit") {
      return "请求过于频繁，请稍后再试。已经收到验证邮件时，请先使用那封邮件。";
    }
  }
  return failure instanceof Error ? failure.message : "登录服务暂时不可用，请稍后重试。";
}

export function AccountWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [backupAt, setBackupAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const localPreview = ready && typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      const authResult = new URLSearchParams(window.location.search).get("auth");
      if (!data.user && (authResult === "failed" || authResult === "invalid")) {
        setError("未能自动登录，邮箱可能已经验证成功。请先在这里使用邮箱和密码登录；只有登录提示邮箱尚未验证时，才需要再次处理验证邮件。");
      } else if (authResult === "confirmed") {
        setMessage(data.user ? "邮箱验证已完成，已登录。" : "验证链接已处理，请使用邮箱和密码登录。");
      }
      // A signed-out visitor normally has no session; this is not a registration error.
      if (authError && !isAuthSessionMissingError(authError)) setError(authFailureMessage(authError));
      setUser(data.user);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        if (!session) setBackupAt(null);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    void supabase.from("user_snapshots").select("updated_at").eq("user_id", user.id).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(`读取云端备份失败：${queryError.message}`);
        else setBackupAt(data?.updated_at ?? null);
      });
    return () => { active = false; };
  }, [user]);

  async function submitAuth(mode: "signin" | "signup") {
    if (!supabase || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        setMessage(data.session ? "账户已创建并登录。" : localPreview
          ? "请打开验证邮件并点击确认链接。若在手机点击后页面打不开，请回到这台电脑，用刚才的邮箱和密码登录；无需重新创建账户。"
          : "请打开验证邮件并点击确认链接。若未自动登录，请回到这里使用邮箱和密码登录。");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        setMessage("已登录。浏览器资料尚未上传；需要时请主动点击备份。");
      }
      setPassword("");
    } catch (failure) {
      setError(authFailureMessage(failure));
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true); setError(null);
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(authError.message);
    else { setUser(null); setBackupAt(null); setMessage("已退出云端账户；浏览器资料仍在本机。"); }
    setBusy(false);
  }

  async function saveCloudBackup() {
    if (!supabase || !user || busy) return;
    if (!window.confirm("把当前浏览器中的对话、画像、目标、人工标记和行动反馈上传到你的知衡云端账户？这会覆盖该账户上一份云端备份，本地资料不会删除。")) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const { data: verified, error: authError } = await supabase.auth.getUser();
      if (authError || verified.user?.id !== user.id) throw new Error("登录状态已失效，请重新登录。");
      const snapshot = readBrowserSnapshot();
      if (snapshotByteLength(snapshot) > 5_000_000) throw new Error("当前资料超过单次备份的 5 MB 上限，尚未上传。");
      const updatedAt = new Date().toISOString();
      const { error: writeError } = await supabase.from("user_snapshots").upsert({
        user_id: user.id, version: 1, payload: snapshot, updated_at: updatedAt,
      });
      if (writeError) throw writeError;
      setBackupAt(updatedAt);
      setMessage("云端备份已保存。本地工作资料仍保持原样；之后的新修改需要再次备份。");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "云端备份失败，本地资料未改变。"); }
    finally { setBusy(false); }
  }

  async function restoreCloudBackup() {
    if (!supabase || !user || !backupAt || busy) return;
    if (!window.confirm("从云端备份恢复会覆盖这个浏览器里的对话、画像、目标和反馈。请先下载本地备份；确定继续吗？")) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const { data: verified, error: authError } = await supabase.auth.getUser();
      if (authError || verified.user?.id !== user.id) throw new Error("登录状态已失效，请重新登录。");
      const { data, error: readError } = await supabase.from("user_snapshots")
        .select("payload").eq("user_id", user.id).single();
      if (readError || !data) throw new Error(readError?.message ?? "云端备份不存在。");
      restoreBrowserSnapshot(data.payload);
      window.location.reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "恢复失败，本地资料未改变。"); }
    finally { setBusy(false); }
  }

  return <section className="account-workspace" aria-labelledby="account-title">
    <header className="page-heading">
      <h1 id="account-title">资料备份与云端账户</h1>
    </header>
    <LocalBackupPanel disabled={busy} />
    {!supabase ? <p className="account-status" role="note">账户暂不可用，仍可在设置中备份资料。</p> :
      !ready ? <p role="status">正在检查登录状态…</p> :
      <div className="account-layout">
        <div className="account-card">
          <h2>{user ? "我的账户" : "登录"}</h2>
          {user ? <>
            <p className="account-identity">{user.email ?? "已登录用户"}</p>
            <button type="button" className="account-secondary" disabled={busy} onClick={() => void signOut()}>退出登录</button>
          </> : <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void submitAuth("signin"); }} className="account-form">
            <label htmlFor="account-email">邮箱</label>
            <input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="account-password">密码</label>
            <input id="account-password" type="password" autoComplete="current-password" minLength={8} placeholder="至少 8 位" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <div className="account-actions">
              <button type="submit" disabled={busy}>登录</button>
              <button type="button" className="account-secondary" disabled={busy}
                onClick={() => { if (formRef.current?.reportValidity()) void submitAuth("signup"); }}>创建账户</button>
            </div>
            {localPreview && <details className="simple-more"><summary>登录遇到问题？</summary><p>手机验证邮件后如果打不开返回页面，请回到这台电脑用邮箱和密码登录。</p></details>}
          </form>}
          {error && <div className="error-notice" role="alert">{error}</div>}
          {message && <p className="account-status" role="status">{message}</p>}
        </div>
        <div className="account-card">
          <h2>云端备份</h2>
          <p>手动备份，不会自动同步。</p>
          <p className="account-backup-time">{user ? backupAt ? `最近一次云端备份：${new Date(backupAt).toLocaleString("zh-CN")}` : "这个账户还没有云端备份。" : "登录后可启用云端备份。"}</p>
          <div className="account-actions">
            <button type="button" onClick={() => void saveCloudBackup()} disabled={!user || busy}>备份到云端</button>
            <button type="button" className="account-secondary" onClick={() => void restoreCloudBackup()} disabled={!user || !backupAt || busy}>从云端恢复</button>
          </div>
        </div>
      </div>}
    <Link href="/backup" className="simple-link">返回资料备份</Link>
  </section>;
}
