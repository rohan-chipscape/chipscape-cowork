"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@/lib/conversations/types";
import { SidebarIcon, NewChatIcon, TrashIcon } from "./icons";

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  userName,
  onLogout,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  conversations: ConversationSummary[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  userName: string;
  onLogout: () => void;
}) {
  const displayName = userName.trim() || "Guest";
  const initial = displayName[0]?.toUpperCase() ?? "G";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (collapsed) {
    return (
      <div className="flex w-[68px] flex-col items-center gap-1 bg-[#000000] py-3">
        <button
          onClick={onToggleCollapsed}
          title="Open sidebar"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/10"
        >
          <SidebarIcon className="h-5 w-5" />
        </button>
        <button
          onClick={onNewChat}
          title="New chat"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/10"
        >
          <NewChatIcon className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-[280px] flex-col bg-[#000000]">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="truncate px-1 text-sm font-semibold text-neutral-200">
          Chipscape Cowork
        </span>
        <button
          onClick={onToggleCollapsed}
          title="Close sidebar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
        >
          <SidebarIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/10"
        >
          <NewChatIcon className="h-[18px] w-[18px]" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <p className="px-2 py-2 text-xs font-medium text-neutral-500">Chats</p>
        {conversations.length === 0 && (
          <p className="px-2 py-2 text-xs text-neutral-600">
            No chats yet — ask something to start one.
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group relative flex items-center rounded-lg text-sm ${
                c.id === activeId
                  ? "bg-[#2f2f2f] text-neutral-100"
                  : "text-neutral-300 hover:bg-white/5"
              }`}
            >
              <button
                onClick={() => onSelect(c.id)}
                className="min-w-0 flex-1 truncate px-3 py-2.5 text-left"
                title={c.title}
              >
                {c.title}
              </button>
              <button
                onClick={() => onDelete(c.id)}
                title="Delete chat"
                className="absolute right-1.5 hidden h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-white/10 hover:text-red-400 group-hover:flex"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div ref={menuRef} className="relative border-t border-white/10">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-white/5"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
            {initial}
          </div>
          <span className="truncate text-sm text-neutral-300">{displayName}</span>
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-lg bg-[#2f2f2f] shadow-xl">
            <button
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="block w-full px-3 py-2.5 text-left text-sm text-neutral-200 hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
