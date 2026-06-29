import { FormEvent, useEffect, useState } from "react";
import { Eye, Plus, Users } from "lucide-react";
import { ConnectionBadge } from "./ConnectionBadge";
import { useTurupStore } from "../socket/useTurupStore";

type JoinCreatePanelProps = {
  initialRoomCode: string;
};

export function JoinCreatePanel({ initialRoomCode }: JoinCreatePanelProps) {
  const createRoom = useTurupStore((state) => state.createRoom);
  const joinRoom = useTurupStore((state) => state.joinRoom);
  const connectionStatus = useTurupStore((state) => state.connectionStatus);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [targetScore, setTargetScore] = useState(100);

  useEffect(() => {
    setRoomCode(initialRoomCode);
  }, [initialRoomCode]);

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRoom(username, displayName, targetScore);
  }

  function onJoin(event: FormEvent<HTMLFormElement>, asSpectator = false) {
    event.preventDefault();
    joinRoom(roomCode, username, displayName, asSpectator);
  }

  function onSpectate() {
    joinRoom(roomCode, username, displayName, true);
  }

  return (
    <div className="grid min-h-[calc(100vh-1.5rem)] content-center gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="surface-panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h1 className="text-3xl font-black leading-none text-stone-50 sm:text-4xl">TURUP</h1>
            <div className="mt-2 text-xs font-bold uppercase tracking-wide text-stone-500">Four seats. One room code.</div>
          </div>
          <ConnectionBadge status={connectionStatus} />
        </header>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr] lg:p-5">
          <form className="subtle-panel p-4" onSubmit={onCreate}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-stone-50">Create table</h2>
              <span className="rounded-md bg-brass/10 px-2 py-1 text-xs font-bold text-brass">Host</span>
            </div>
            <IdentityFields
              username={username}
              displayName={displayName}
              setUsername={setUsername}
              setDisplayName={setDisplayName}
              idPrefix="create"
            />
            <div className="mt-4">
              <label className="field-label" htmlFor="targetScore">
                Target score
              </label>
              <input
                id="targetScore"
                type="number"
                min={1}
                max={1000}
                className="field-input"
                value={targetScore}
                onChange={(event) => setTargetScore(Number(event.target.value))}
              />
            </div>
            <button className="primary-button mt-5 w-full" type="submit">
              <Plus className="h-4 w-4" />
              Create room
            </button>
          </form>

          <form className="subtle-panel p-4" onSubmit={(event) => onJoin(event)}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-stone-50">Join table</h2>
              <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">Room code</span>
            </div>
            <IdentityFields
              username={username}
              displayName={displayName}
              setUsername={setUsername}
              setDisplayName={setDisplayName}
              idPrefix="join"
            />
            <div className="mt-4">
              <label className="field-label" htmlFor="roomCode">
                Room code
              </label>
              <input
                id="roomCode"
                className="field-input font-mono uppercase tracking-widest"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
                placeholder="ABCDE"
              />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button className="success-button" type="submit">
                <Users className="h-4 w-4" />
                Join
              </button>
              <button className="secondary-button" type="button" onClick={onSpectate}>
                <Eye className="h-4 w-4" />
                Spectate
              </button>
            </div>
          </form>
        </div>
      </section>

      <aside className="table-felt flex min-h-[27rem] flex-col justify-between rounded-lg p-5">
        <div className="grid grid-cols-3 items-center gap-3">
          <SeatPreview label="P3" />
          <div className="h-16 rounded-md border border-brass/25 bg-black/20" />
          <SeatPreview label="P4" />
        </div>
        <div className="mx-auto my-8 grid w-full max-w-72 grid-cols-4 gap-2">
          {["A", "K", "Q", "J", "10", "9", "8", "7"].map((rank, index) => (
            <div
              key={`${rank}-${index}`}
              className="flex h-20 items-start justify-between rounded-md border border-stone-200 bg-stone-50 px-2 py-2 text-sm font-black text-[#171214] shadow-card"
            >
              <span>{rank}</span>
              <span className={index % 2 === 0 ? "text-ember" : "text-slate-950"}>{index % 2 === 0 ? "♥" : "♠"}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 items-center gap-3">
          <SeatPreview label="P2" />
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3 text-center">
            <div className="text-xs font-bold uppercase tracking-wide text-stone-400">Table</div>
            <div className="mt-1 font-mono text-xl font-black text-brass">READY</div>
          </div>
          <SeatPreview label="P1" />
        </div>
      </aside>
    </div>
  );
}

function IdentityFields({
  username,
  displayName,
  setUsername,
  setDisplayName,
  idPrefix
}: {
  username: string;
  displayName: string;
  setUsername: (value: string) => void;
  setDisplayName: (value: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-username`}>
          Username
        </label>
        <input
          id={`${idPrefix}-username`}
          className="field-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={18}
          autoComplete="off"
          placeholder="Player name"
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-displayName`}>
          Display name
        </label>
        <input
          id={`${idPrefix}-displayName`}
          className="field-input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={28}
          autoComplete="off"
          placeholder="Optional"
        />
      </div>
    </div>
  );
}

function SeatPreview({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#121113]/80 px-3 py-3 text-center shadow-card">
      <div className="text-xs font-bold text-stone-500">{label}</div>
      <div className="mx-auto mt-2 h-2 w-10 rounded-full bg-emerald-300/80" />
    </div>
  );
}
