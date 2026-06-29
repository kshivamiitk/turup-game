"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GameTable } from "../components/GameTable";
import { JoinCreatePanel } from "../components/JoinCreatePanel";
import { Lobby } from "../components/Lobby";
import { useTurupStore } from "../socket/useTurupStore";

export default function HomePage() {
  const initSocket = useTurupStore((state) => state.initSocket);
  const room = useTurupStore((state) => state.room);
  const isRestoringSession = useTurupStore((state) => state.isRestoringSession);
  const error = useTurupStore((state) => state.error);
  const clearError = useTurupStore((state) => state.clearError);
  const [initialRoomCode, setInitialRoomCode] = useState("");

  useEffect(() => {
    initSocket();
    const params = new URLSearchParams(window.location.search);
    setInitialRoomCode(params.get("room") ?? "");
  }, [initSocket]);

  const screen = useMemo(() => {
    if (isRestoringSession && !room) {
      return (
        <div className="grid min-h-[calc(100vh-1.5rem)] place-items-center">
          <div className="surface-panel px-6 py-5 text-center">
            <div className="text-lg font-black text-stone-50">Reconnecting</div>
            <div className="mt-2 text-sm font-bold text-stone-500">Restoring your room seat.</div>
          </div>
        </div>
      );
    }

    if (!room) {
      return <JoinCreatePanel initialRoomCode={initialRoomCode} />;
    }

    if (room.phase === "lobby") {
      return <Lobby room={room} />;
    }

    return <GameTable room={room} />;
  }, [initialRoomCode, isRestoringSession, room]);

  return (
    <main className="min-h-screen px-3 py-3 text-stone-100 sm:px-5 lg:px-6">
      <div className="app-frame flex min-h-[calc(100vh-1.5rem)] flex-col">{screen}</div>
      <AnimatePresence>
        {error ? (
          <motion.div
            className="fixed right-4 top-4 z-50 flex max-w-sm items-center gap-3 rounded-md border border-ember/60 bg-[#2a1111] px-4 py-3 text-sm text-red-50 shadow-card"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="alert"
          >
            <span className="flex-1">{error}</span>
            <button className="rounded p-1 text-red-100 hover:bg-white/10" onClick={clearError} aria-label="Dismiss error">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
