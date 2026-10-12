import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./product.css";
import "./refinement.css";
import "./questionnaire.css";
import "./personal-context.css";
import "./desktop-ui.css";
import "./chat-desktop.css";
import "./profile-desktop.css";
import "./motion.css";

export const metadata: Metadata = {
  title: "知衡 · 个人认知 AI",
  description: "从对话开始，逐步建立由用户掌控的个人记忆与画像。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
