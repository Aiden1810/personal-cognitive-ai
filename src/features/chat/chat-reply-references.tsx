import type { ChatMessage, Conversation } from "@/lib/chat/store";
import type { ProfileInsight, UserGoal } from "@/types/cognitive";
import { resolveChatReferences } from "@/lib/chat/references";
import { ChatContextPanel } from "./chat-context-panel";
import { memo } from "react";

export const ChatReplyReferences = memo(function ChatReplyReferences({ message, conversation, conversations, insights, goals }: {
  message: ChatMessage;
  conversation: Conversation;
  conversations: Conversation[];
  insights: ProfileInsight[];
  goals: UserGoal[];
}) {
  if (!message.references) return (
    <details className="chat-context-panel chat-reply-references">
      <summary><span>本次参考资料<small>未记录</small></span></summary>
      <div className="chat-context-body"><p className="chat-context-note">这条回复没有保存参考记录，无法还原当时附加了哪些资料。</p></div>
    </details>
  );
  const references = message.references;
  const { selection, unavailableCount } = resolveChatReferences(references, insights, goals, conversations);
  return <ChatContextPanel selection={selection} phase="complete"
    question={conversation.messages.find((item) => item.id === references.sourceMessageId)?.content ?? ""}
    conversations={conversations} currentInsights={insights} currentGoals={goals}
    referenceRecord={references} unavailableCount={unavailableCount} />;
});
