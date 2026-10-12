"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Ellipsis, Trash2 } from "lucide-react";
import type { Conversation } from "@/lib/chat/store";

export function ConversationListItem({ conversation, selected, disabled, onSelect, onDelete }: {
  conversation: Conversation;
  selected: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    deleteRef.current?.focus({ preventScroll: true });
    function close() {
      if (document.activeElement === deleteRef.current) openerRef.current?.focus({ preventScroll: true });
      setIsOpen(false);
    }
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", close);
    // A menu anchored to a list item should close when the page or list scrolls.
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [isOpen]);

  function open(left: number, top: number, opener: HTMLButtonElement) {
    if (disabled) return;
    openerRef.current = opener;
    setPosition({
      left: Math.max(8, Math.min(left, window.innerWidth - 176)),
      top: Math.max(8, Math.min(top, window.innerHeight - 60)),
    });
    setIsOpen(true);
  }

  function contextMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    open(event.clientX, event.clientY, event.currentTarget);
  }

  function keyboardMenu(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    open(bounds.left + 12, bounds.bottom, event.currentTarget);
  }

  return (
    <div className="chat-thread-row" ref={rootRef}>
      <button type="button"
        className={`chat-thread-item ${selected ? "is-selected" : ""}`}
        onClick={() => { setIsOpen(false); onSelect(conversation.id); }}
        onContextMenu={contextMenu} onKeyDown={keyboardMenu}
        disabled={disabled} aria-current={selected ? "true" : undefined}
        aria-haspopup="menu" aria-expanded={isOpen}>
        <span>{conversation.title}</span>
      </button>
      <button type="button" className="chat-thread-more" aria-label={`更多操作：${conversation.title}`}
        disabled={disabled} aria-haspopup="menu" aria-expanded={isOpen}
        onClick={(event) => {
          if (isOpen) { setIsOpen(false); return; }
          const bounds = event.currentTarget.getBoundingClientRect();
          open(bounds.left, bounds.bottom + 4, event.currentTarget);
        }}><Ellipsis size={17} aria-hidden="true" /></button>
      <div className="chat-thread-menu" role="menu" aria-label="对话操作"
        data-state={isOpen ? "open" : "closed"} aria-hidden={!isOpen} inert={!isOpen}
        style={position} onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            // Restore the real opener before Tab advances to its next/previous control.
            openerRef.current?.focus({ preventScroll: true });
            setIsOpen(false);
            if (event.key === "Escape") event.preventDefault();
          } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
            event.preventDefault(); deleteRef.current?.focus();
          }
        }}>
        <button ref={deleteRef} type="button" role="menuitem" disabled={disabled}
          onClick={() => { openerRef.current?.focus({ preventScroll: true }); setIsOpen(false); onDelete(conversation.id); }}>
          <Trash2 size={14} aria-hidden="true" />删除对话
        </button>
      </div>
    </div>
  );
}
