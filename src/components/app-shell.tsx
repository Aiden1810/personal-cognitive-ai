"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useDemoData } from "@/lib/data";

const navigation = [
  {
    href: "/history",
    number: "01",
    label: "历史与模式",
    note: "理解过去的选择",
  },
  { href: "/goals", number: "02", label: "我的目标", note: "决定想改变什么" },
  {
    href: "/decision",
    number: "03",
    label: "决策对比",
    note: "让依据进入新选择",
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isChat = path === "/chat";
  const isProfile = path === "/profile";
  const isProduct = isChat || isProfile;
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
    <div className="workspace">
      <a href="#main-content" className="skip-link">
        跳到页面内容
      </a>
      <aside className="sidebar">
        <Link href="/chat" className="brand" aria-label="知衡首页">
          <span className="brand-mark" aria-hidden="true">
            衡
          </span>
          <span>
            <strong>知衡</strong>
            <small>PERSONAL COGNITIVE AI</small>
          </span>
        </Link>
        <div className="sidebar-caption">从对话开始认识自己</div>
        <nav className="primary-navigation" aria-label="主要导航">
          <Link
            href="/chat"
            className={`nav-item ${isChat ? "is-active" : ""}`}
            aria-current={isChat ? "page" : undefined}
          >
            <span className="nav-number">01</span>
            <span>
              <strong>对话</strong>
              <small>记录想法与经历</small>
            </span>
            <span className="nav-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
          <Link
            href="/profile"
            className={`nav-item ${isProfile ? "is-active" : ""}`}
            aria-current={isProfile ? "page" : undefined}
          >
            <span className="nav-number">02</span>
            <span>
              <strong>我的画像</strong>
              <small>七维画像与目标</small>
            </span>
            <span className="nav-arrow" aria-hidden="true">↗</span>
          </Link>
        </nav>
        <details className="legacy-navigation">
          <summary>旧版决策演示</summary>
          <nav aria-label="旧版决策演示">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${path === item.href ? "is-active" : ""}`}
                aria-current={path === item.href ? "page" : undefined}
              >
                <span className="nav-number">{item.number}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </span>
                <span className="nav-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </nav>
        </details>
        <div className="sidebar-bottom">
          <span className="status-dot" /> 本地开发版本
          <p>
            安 · 姚 · 曹<br />
            聊天、记忆、画像由用户掌控。
          </p>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>知衡 / {isChat ? "对话" : isProfile ? "我的画像" : "旧版决策演示"}</span>
          <span className="badge">本地原型</span>
        </header>
        <main id="main-content" className={isChat ? "chat-main" : undefined}>
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
        <footer className="footer">
          <span>
            {isProduct
              ? "从对话到记忆，再到可编辑的个人画像"
              : "旧版决策演示，仅供参考"}
          </span>
          <span>{isProduct ? "数据仅保存在本浏览器；对话或提取时由 DeepSeek 处理" : "数据仅保存在本浏览器"}</span>
        </footer>
      </div>
    </div>
  );
}
