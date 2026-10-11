"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Conversation } from "@/lib/chat/store";

export function ConversationListItem({ conversation, selected, disabled, onSelect, onDelete }: {
  conversation: Conversation;
  selected: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!position) return;
    deleteRef.current?.focus();
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setPosition(null);
    }
    function close() { setPosition(null); }
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", close);
    // A menu anchored to a list item should close when the page or list scrolls.
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);

  function open(left: number, top: number) {
    if (disabled) return;
    setPosition({
      left: Math.max(8, Math.min(left, window.innerWidth - 176)),
      top: Math.max(8, Math.min(top, window.innerHeight - 60)),
    });
  }

  function contextMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    open(event.clientX, event.clientY);
  }

  function keyboardMenu(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    open(bounds.left + 12, bounds.bottom);
  }

  return (
    <div className="chat-thread-row" ref={rootRef}>
      <button ref={triggerRef} type="button"
        className={`chat-thread-item ${selected ? "is-selected" : ""}`}
        onClick={() => { setPosition(null); onSelect(conversation.id); }}
        onContextMenu={contextMenu} onKeyDown={keyboardMenu}
        disabled={disabled} aria-current={selected ? "true" : undefined}
        aria-haspopup="menu" aria-expanded={position !== null}>
        <span>{conversation.title}</span>
      </button>
      <button type="button" className="chat-thread-more" aria-label={`更多操作：${conversation.title}`}
        disabled={disabled} aria-haspopup="menu" aria-expanded={position !== null}
        onClick={(event) => {
          if (position) { setPosition(null); return; }
          const bounds = event.currentTarget.getBoundingClientRect();
          open(bounds.left, bounds.bottom + 4);
        }}>⋯</button>
      {position && <div className="chat-thread-menu" role="menu" aria-label="对话操作"
        style={position} onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            setPosition(null);
            if (event.key === "Escape") { event.preventDefault(); triggerRef.current?.focus(); }
          } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
            event.preventDefault(); deleteRef.current?.focus();
          }
        }}>
        <button ref={deleteRef} type="button" role="menuitem" disabled={disabled}
          onClick={() => { setPosition(null); onDelete(conversation.id); }}>
          删除对话
        </button>
      </div>}
    </div>
  );
}
