import { createElement } from "react";
import Markdown, { type Components } from "react-markdown";
import type { ChatMessage } from "../../lib/chat/store.ts";

const components: Components = {
  a: ({ children, href, title }) => href
    ? createElement("a", { href, title, target: "_blank", rel: "noopener noreferrer" }, children)
    : createElement("span", null, children),
};

export function ChatMessageContent({ role, content }: Pick<ChatMessage, "role" | "content">) {
  // User input stays literal; Markdown affects only the presentation of AI replies.
  if (role === "user") return createElement("p", null, content);
  return createElement("div", { className: "chat-message-body" },
    createElement(Markdown, { skipHtml: true, disallowedElements: ["img"], components }, content));
}
