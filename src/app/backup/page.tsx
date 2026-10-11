import { LocalBackupPanel } from "@/features/account/local-backup-panel";
import Link from "next/link";

export default function BackupPage() {
  return (
    <section className="account-workspace" aria-labelledby="backup-title">
      <header className="page-heading">
        <h1 id="backup-title">资料备份</h1>
      </header>
      <LocalBackupPanel />
      <div className="backup-secondary">
        <Link href="/account" prefetch={false} className="simple-link">云端账户与备份 ↗</Link>
        <details className="simple-more">
          <summary>数据与隐私</summary>
          <div className="simple-note">
            <p>日常对话和画像保存在当前浏览器。清理浏览器数据前，请先备份。</p>
            <p>聊天时，近期对话、相关已确认画像、目标和回答偏好会发送给 DeepSeek。整理记忆时也会发送相应发言；新发现需要你确认。</p>
            <p>云端备份由你手动上传，不是自动同步。退出账户不会清除浏览器资料。</p>
          </div>
        </details>
      </div>
    </section>
  );
}
