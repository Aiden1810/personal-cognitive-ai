"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const primaryLinks = [
  { href: "/chat", label: "对话" },
  { href: "/profile", label: "我的画像" },
  { href: "/progress", label: "行动记录" },
];

/** Both chat and other pages use this navigation; chat adds its existing list. */
export function AppSidebar({ children, className = "" }: {
  children?: ReactNode;
  className?: string;
}) {
  const path = usePathname();

  return (
    <aside className={`sidebar app-sidebar ${className}`} aria-label="知衡导航">
      <Link href="/chat" className="brand" aria-label="知衡首页">
        <Image src="/icon.svg" alt="" width={40} height={40} className="brand-icon" />
        <span><strong>知衡</strong><small>以对话，见自己</small></span>
      </Link>
      <nav className="primary-navigation" aria-label="主要导航">
        {primaryLinks.map(({ href, label }) => {
          const active = path === href || (href === "/profile" && path === "/onboarding");
          return (
            <Link key={href} href={href} className={`nav-item ${active ? "is-active" : ""}`}
              aria-current={path === href ? "page" : undefined}>
              <strong>{label}</strong>
            </Link>
          );
        })}
      </nav>
      {children}
      <nav className="sidebar-utilities" aria-label="资料管理">
        <Link href="/backup"
          className={`nav-item ${path === "/backup" || path === "/account" ? "is-active" : ""}`}
          aria-current={path === "/backup" ? "page" : undefined}>
          <strong>资料备份</strong>
        </Link>
        <p>由你确认，由你管理</p>
      </nav>
    </aside>
  );
}
