import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react";
import type { PublicPlayer, RoomSnapshot } from "../types/game";
import { useCallStore } from "../socket/useCallStore";
import { cn } from "../utils/classNames";

export function MediaControls({ className }: { className?: string }) {
  const mic = useCallStore((state) => state.mic);
  const cam = useCallStore((state) => state.cam);
  const toggleMic = useCallStore((state) => state.toggleMic);
  const toggleCam = useCallStore((state) => state.toggleCam);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        className={cn("media-button", mic ? "media-on" : "media-off")}
        onClick={() => void toggleMic()}
        aria-pressed={mic}
        aria-label={mic ? "Mute microphone" : "Unmute microphone"}
        title={mic ? "Mute" : "Unmute"}
      >
        {mic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </button>
      <button
        className={cn("media-button", cam ? "media-on" : "media-off")}
        onClick={() => void toggleCam()}
        aria-pressed={cam}
        aria-label={cam ? "Turn camera off" : "Turn camera on"}
        title={cam ? "Camera off" : "Camera on"}
      >
        {cam ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function CallPanel({ room, className }: { room: RoomSnapshot; className?: string }) {
  const localStream = useCallStore((state) => state.localStream);
  const remoteStreams = useCallStore((state) => state.remoteStreams);
  const peerStates = useCallStore((state) => state.peerStates);
  const audioLocked = useCallStore((state) => state.audioLocked);
  const unlockAudio = useCallStore((state) => state.unlockAudio);
  const mediaError = useCallStore((state) => state.mediaError);

  return (
    <section className={cn("surface-panel overflow-hidden", className)} aria-label="Video call">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="text-sm font-black text-stone-100">Table call</div>
        {room.me.isSpectator ? <span className="text-xs font-bold text-stone-500">Players only</span> : <MediaControls />}
      </div>
      {audioLocked ? (
        <button className="flex w-full items-center justify-center gap-2 bg-brass px-3 py-2 text-sm font-black text-ink" onClick={unlockAudio}>
          <Volume2 className="h-4 w-4" /> Tap to hear the table
        </button>
      ) : null}
      {mediaError ? <div className="bg-ember/15 px-3 py-2 text-xs font-bold text-red-100">{mediaError}</div> : null}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 md:grid-cols-4 lg:grid-cols-2">
        {room.players.map((player) => {
          const isMe = player.username === room.me.username;
          return (
            <VideoTile
              key={player.username}
              player={player}
              isMe={isMe}
              stream={isMe ? localStream : remoteStreams[player.username] ?? null}
              linkState={isMe ? undefined : peerStates[player.username]}
              active={player.seat === room.currentTurnSeat}
            />
          );
        })}
      </div>
    </section>
  );
}

function VideoTile({
  player,
  isMe,
  stream,
  linkState,
  active
}: {
  player: PublicPlayer;
  isMe: boolean;
  stream: MediaStream | null;
  linkState: RTCPeerConnectionState | undefined;
  active: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const audioLocked = useCallStore((state) => state.audioLocked);

  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (stream) {
      video.play().catch((error: DOMException) => {
        // Browser blocked autoplay with sound until the user taps something. (AbortError just means a newer play() replaced this one.)
        if (!isMe && error.name === "NotAllowedError") {
          useCallStore.setState({ audioLocked: true });
        }
      });
    }
  }, [stream, isMe, audioLocked, player.cam]);

  const showVideo = Boolean(stream) && player.cam;
  const reconnecting = !isMe && player.connected && (linkState === "connecting" || linkState === "failed" || linkState === "disconnected");

  return (
    <div className={cn("video-tile", active && "video-tile-active")}>
      {/* The element stays mounted even with the camera off so remote audio keeps playing. */}
      <video ref={ref} autoPlay playsInline muted={isMe} className={cn("h-full w-full object-cover", isMe && "-scale-x-100", !showVideo && "invisible")} />
      {!showVideo ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brass/20 text-lg font-black text-brass sm:h-14 sm:w-14">
            {player.displayName.slice(0, 1).toUpperCase()}
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
        <span className="truncate rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-black text-stone-100">
          {isMe ? "You" : player.displayName}
        </span>
        <span className="flex gap-1">
          {!player.connected ? <span className="rounded bg-ember/80 px-1.5 py-0.5 text-[10px] font-black">offline</span> : null}
          {reconnecting ? <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-black text-brass">linking…</span> : null}
          <span className="rounded bg-black/60 p-1">{player.mic ? <Mic className="h-3 w-3 text-emerald-300" /> : <MicOff className="h-3 w-3 text-red-300" />}</span>
        </span>
      </div>
    </div>
  );
}
