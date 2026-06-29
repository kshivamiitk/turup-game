import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import type { RoomSnapshot } from "../types/game";
import { useTurupStore } from "../socket/useTurupStore";

type ChatPanelProps = {
  room: RoomSnapshot;
};

export function ChatPanel({ room }: ChatPanelProps) {
  const sendChat = useTurupStore((state) => state.sendChat);
  const [message, setMessage] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    sendChat(trimmed);
    setMessage("");
  }

  return (
    <aside className="surface-panel flex min-h-64 flex-col overflow-hidden">
      <div className="border-b border-white/10 px-3 py-3 text-sm font-black">Chat</div>
      <div className="scrollbar-thin flex max-h-72 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {room.chat.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-sm text-stone-500">No messages</div>
        ) : (
          room.chat.map((chat) => (
            <div key={chat.id} className="rounded-md bg-white/[0.055] px-3 py-2">
              <div className="text-xs font-black text-brass">{chat.displayName}</div>
              <div className="mt-1 break-words text-sm text-stone-100">{chat.message}</div>
            </div>
          ))
        )}
      </div>
      <form className="flex gap-2 border-t border-white/10 p-3" onSubmit={onSubmit}>
        <input
          className="field-input min-w-0 flex-1"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={240}
          placeholder="Message"
          aria-label="Chat message"
        />
        <button
          className="icon-button border-brass/30 bg-brass text-ink hover:bg-[#e2bd68]"
          type="submit"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}
