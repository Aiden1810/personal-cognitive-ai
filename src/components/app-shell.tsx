"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useDemoData } from "@/lib/data";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isChat = path === "/chat";
  const isProfile = path === "/profile";
  const isOnboarding = path === "/onboarding";
  const isOutcomes = path === "/progress";
  const isAccount = path === "/account";
  const isBackup = path === "/backup";
  const isProduct = isChat || isProfile || isOnboarding || isOutcomes || isAccount || isBackup;
  const { state, ready, error, saveCase, reset } = useDemoData();
  const [message, setMessage] = useState("");

  function checkSaving() {
    const record = state?.cases.find((item) => item.id === "sample-case-1");
    if (record && saveCase(record))
      setMessage("占位记录已保存。刷新页面后仍可读取；仅保存于当前浏览器。");
    else setMessage("未完成保存，请查看错误提示或重置占位资料。");
  }

  function resetData() {
    if (
      window.confirm(
        "重置会覆盖当前浏览器中的案例、目标与反馈。确认恢复合成占位资料吗？",
      ) &&
      reset()
    ) {
      setMessage("已恢复合成占位资料。");
    }
  }

  return (
    <div className={`workspace desktop-workspace ${isChat ? "workspace--chat" : ""}`}>
      <a href="#main-content" className="skip-link">
        跳到页面内容
      </a>
      {!isChat && <AppSidebar />}
      <div className="main-column">
        {!isChat && !isProfile && <header className="topbar">
          <span>{isChat ? "对话" : isOnboarding ? "初始问卷" : isProfile ? "我的画像" : isOutcomes ? "行动记录" : isBackup ? "资料备份" : isAccount ? "云端账户" : "旧版决策演示"}</span>
        </header>}
        <main id="main-content" className={isChat ? "chat-main" : isProfile ? "profile-main" : undefined}>
          {!isProduct && (
            <div className="prototype-notice">
              <span aria-hidden="true">◌</span>
              <p>
                当前为项目骨架。资料是合成占位示例，AI
                尚未接入；具体演示场景稍后确定。
              </p>
            </div>
          )}
          {!isProduct && error && (
            <div className="error-notice" role="alert">
              {error}
            </div>
          )}
          {!isProduct && !ready ? (
            <p className="loading" role="status">
              正在读取本地资料…
            </p>
          ) : (
            children
          )}
          {!isProduct && (
            <details className="developer-check">
              <summary>团队开发检查</summary>
              <p>
                所有页面使用同一数据入口。可以保存占位记录，刷新后检查是否保留；此操作不会调用
                AI。
              </p>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={checkSaving}
                  disabled={
                    !state?.cases.some((item) => item.id === "sample-case-1")
                  }
                >
                  检查本地保存
                </button>
                <button className="text-button" onClick={resetData}>
                  重置占位资料
                </button>
              </div>
              {message && (
                <p role="status" className="save-message">
                  {message}
                </p>
              )}
            </details>
          )}
        </main>
        {!isProduct && <footer className="footer">
          <span>
            {isProduct
              ? "从对话、画像到实际行动，持续由你核对"
              : "旧版决策演示，仅供参考"}
          </span>
          <span>{isProduct ? "日常资料存于本浏览器；可主动云端备份；AI 调用由 DeepSeek 处理" : "数据仅保存在本浏览器"}</span>
        </footer>}
      </div>
    </div>
  );
}
