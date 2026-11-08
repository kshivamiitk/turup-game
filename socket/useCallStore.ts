"use client";

import { create } from "zustand";
import type { RoomSnapshot } from "../types/game";
import type { RealtimeClientSocket } from "./realtimeClient";

/**
 * 4-way video/voice over a WebRTC mesh (each player connects directly to the other 3).
 * Signaling rides on the existing game WebSocket via `rtc_signal`.
 *
 * Per pair, the player with the alphabetically smaller username is the "caller": it creates
 * the audio+video transceivers and sends offers. Toggling mic/cam swaps tracks with
 * replaceTrack, so no renegotiation is needed. Whoever (re)joins says `hello`; a caller that
 * hears hello starts a fresh connection and offers. That covers
 * refreshes and dropped networks on either side. Each connection has an id so late messages
 * for a replaced connection are ignored.
 *
 * ponytail: mesh tops out around 4-6 people; switch to an SFU (LiveKit, mediasoup) for bigger rooms.
 */

type Signal =
  | { type: "hello" }
  | { type: "offer"; id: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; id: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; id: string; candidate: RTCIceCandidateInit };

type Peer = {
  id: string;
  pc: RTCPeerConnection;
  caller: boolean;
  queue: Promise<void>;
};

type CallState = {
  mic: boolean;
  cam: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerStates: Record<string, RTCPeerConnectionState>;
  audioLocked: boolean;
  mediaError: string | null;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  unlockAudio: () => void;
};

const prefsKey = "turup.mediaPrefs";
const videoConstraints: MediaTrackConstraints = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 15, max: 20 },
  facingMode: "user"
};
const maxVideoBitrate = 250_000;

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(","),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    });
  }
  return servers;
}

let socket: RealtimeClientSocket | null = null;
let me: string | null = null;
let restoredPrefs = false;
const peers = new Map<string, Peer>();
const localTracks: { audio: MediaStreamTrack | null; video: MediaStreamTrack | null } = { audio: null, video: null };

export const useCallStore = create<CallState>((set, get) => ({
  mic: false,
  cam: false,
  localStream: null,
  remoteStreams: {},
  peerStates: {},
  audioLocked: false,
  mediaError: null,
  toggleMic: () => setTrack("audio", !get().mic),
  toggleCam: () => setTrack("video", !get().cam),
  unlockAudio: () => set({ audioLocked: false })
}));

export function attachCallSocket(nextSocket: RealtimeClientSocket): void {
  socket = nextSocket;
  socket.on("rtc_signal", (payload: { from: string; data: Signal }) => {
    if (payload?.from && payload.data) {
      onSignal(payload.from, payload.data);
    }
  });
}

/** Called on every room snapshot: opens/closes peer connections to match who is connected. */
export function syncCall(room: RoomSnapshot | null): void {
  const nextMe = room && !room.me.isSpectator ? room.me.username : null;
  if (nextMe !== me) {
    closeAll();
    me = nextMe;
  }

  if (!room || !me) {
    if (localTracks.audio || localTracks.video) {
      stopLocal();
    }
    return;
  }

  if (!restoredPrefs) {
    restoredPrefs = true;
    void restorePrefs();
  }

  // Heal server-side indicators after a reconnect (server resets mic/cam on disconnect).
  const mine = room.players.find((player) => player.username === me);
  const { mic, cam } = useCallStore.getState();
  if (mine && (mine.mic !== mic || mine.cam !== cam)) {
    socket?.emit("set_media", { mic, cam });
  }

  const wanted = new Set(room.players.filter((p) => p.connected && p.username !== me).map((p) => p.username));
  for (const username of [...peers.keys()]) {
    if (!wanted.has(username)) {
      closePeer(username);
    }
  }
  for (const username of wanted) {
    if (!peers.has(username)) {
      startPeer(username);
    }
  }
}

function isCaller(remote: string): boolean {
  return (me ?? "") < remote;
}

function startPeer(remote: string): void {
  if (isCaller(remote)) {
    makeOffer(remote, createPeer(remote, crypto.randomUUID()));
  } else {
    createPeer(remote, "");
  }
  send(remote, { type: "hello" });
}

function createPeer(remote: string, id: string): Peer {
  closePeer(remote);
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const peer: Peer = { id, pc, caller: isCaller(remote), queue: Promise.resolve() };
  peers.set(remote, peer);

  if (peer.caller) {
    for (const kind of ["audio", "video"] as const) {
      const transceiver = pc.addTransceiver(localTracks[kind] ?? kind, { direction: "sendrecv" });
      if (kind === "video") {
        void capBitrate(transceiver.sender);
      }
    }
  }

  pc.onicecandidate = (event) => {
    if (event.candidate && peer.id) {
      send(remote, { type: "ice", id: peer.id, candidate: event.candidate.toJSON() });
    }
  };

  pc.ontrack = (event) => {
    const stream = useCallStore.getState().remoteStreams[remote] ?? new MediaStream();
    if (!stream.getTracks().includes(event.track)) {
      stream.addTrack(event.track);
    }
    useCallStore.setState((state) => ({ remoteStreams: { ...state.remoteStreams, [remote]: stream } }));
  };

  pc.onconnectionstatechange = () => {
    if (peers.get(remote)?.pc !== pc) {
      return;
    }
    useCallStore.setState((state) => ({ peerStates: { ...state.peerStates, [remote]: pc.connectionState } }));
    // Network changed (wifi <-> mobile data): the caller restarts ICE on the same connection.
    if (pc.connectionState === "failed" && peer.caller) {
      pc.restartIce();
      makeOffer(remote, peer);
    }
  };

  return peer;
}

function makeOffer(remote: string, peer: Peer): void {
  enqueue(peer, async () => {
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    send(remote, { type: "offer", id: peer.id, sdp: peer.pc.localDescription!.toJSON() });
  });
}

function onSignal(from: string, signal: Signal): void {
  if (!me) {
    return;
  }

  if (signal.type === "hello") {
    // The other side (re)started.
    if (isCaller(from)) {
      makeOffer(from, createPeer(from, crypto.randomUUID()));
    } else {
      // Caller restarted; it sends its offer right after this hello.
      createPeer(from, "");
    }
    return;
  }

  if (signal.type === "offer") {
    let peer = peers.get(from);
    if (!peer || peer.id !== signal.id) {
      peer = createPeer(from, signal.id);
    }
    const target = peer;
    enqueue(target, async () => {
      await target.pc.setRemoteDescription(signal.sdp);
      for (const transceiver of target.pc.getTransceivers()) {
        const kind = transceiver.receiver.track.kind as "audio" | "video";
        transceiver.direction = "sendrecv";
        await transceiver.sender.replaceTrack(localTracks[kind]);
        if (kind === "video") {
          await capBitrate(transceiver.sender);
        }
      }
      await target.pc.setLocalDescription(await target.pc.createAnswer());
      send(from, { type: "answer", id: target.id, sdp: target.pc.localDescription!.toJSON() });
    });
    return;
  }

  const peer = peers.get(from);
  if (!peer || peer.id !== signal.id) {
    return;
  }

  if (signal.type === "answer") {
    enqueue(peer, async () => {
      if (peer.pc.signalingState === "have-local-offer") {
        await peer.pc.setRemoteDescription(signal.sdp);
      }
    });
  } else if (signal.type === "ice") {
    enqueue(peer, () => peer.pc.addIceCandidate(signal.candidate));
  }
}

/** Serialize async signaling per peer so candidates never race their descriptions. */
function enqueue(peer: Peer, task: () => Promise<void>): void {
  peer.queue = peer.queue.then(task).catch((error) => console.warn("[call]", error));
}

function send(to: string, data: Signal): void {
  socket?.emit("rtc_signal", { to, data });
}

async function capBitrate(sender: RTCRtpSender): Promise<void> {
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = maxVideoBitrate;
    await sender.setParameters(params);
  } catch {
    // Not supported before negotiation in some browsers; the browser's own congestion control still applies.
  }
}

async function setTrack(kind: "audio" | "video", on: boolean): Promise<void> {
  const flag = kind === "audio" ? "mic" : "cam";
  useCallStore.setState({ mediaError: null });

  localTracks[kind]?.stop();
  localTracks[kind] = null;

  if (on) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "audio" ? { audio: { echoCancellation: true, noiseSuppression: true } } : { video: videoConstraints }
      );
      localTracks[kind] = stream.getTracks()[0];
    } catch {
      useCallStore.setState({
        mediaError: kind === "audio" ? "Microphone blocked. Allow it in your browser settings." : "Camera blocked. Allow it in your browser settings."
      });
      on = false;
    }
  }

  for (const peer of peers.values()) {
    for (const transceiver of peer.pc.getTransceivers()) {
      if (transceiver.receiver.track.kind === kind && transceiver.currentDirection !== "stopped") {
        void transceiver.sender.replaceTrack(localTracks[kind]).catch(() => undefined);
      }
    }
  }

  const tracks = [localTracks.audio, localTracks.video].filter(Boolean) as MediaStreamTrack[];
  useCallStore.setState({ [flag]: on, localStream: tracks.length ? new MediaStream(tracks) : null } as Partial<CallState>);
  const { mic, cam } = useCallStore.getState();
  savePrefs(mic, cam);
  socket?.emit("set_media", { mic, cam });
}

async function restorePrefs(): Promise<void> {
  try {
    const prefs = JSON.parse(window.localStorage.getItem(prefsKey) ?? "{}") as { mic?: boolean; cam?: boolean };
    if (prefs.mic) {
      await setTrack("audio", true);
    }
    if (prefs.cam) {
      await setTrack("video", true);
    }
  } catch {
    // Ignore bad prefs.
  }
}

function savePrefs(mic: boolean, cam: boolean): void {
  try {
    window.localStorage.setItem(prefsKey, JSON.stringify({ mic, cam }));
  } catch {
    // Storage blocked (private mode): prefs just won't survive refresh.
  }
}

function closePeer(username: string): void {
  peers.get(username)?.pc.close();
  peers.delete(username);
  useCallStore.setState((state) => {
    const remoteStreams = { ...state.remoteStreams };
    const peerStates = { ...state.peerStates };
    delete remoteStreams[username];
    delete peerStates[username];
    return { remoteStreams, peerStates };
  });
}

function closeAll(): void {
  for (const username of [...peers.keys()]) {
    closePeer(username);
  }
}

function stopLocal(): void {
  localTracks.audio?.stop();
  localTracks.video?.stop();
  localTracks.audio = null;
  localTracks.video = null;
  restoredPrefs = false;
  useCallStore.setState({ mic: false, cam: false, localStream: null });
}
