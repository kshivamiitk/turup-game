import { Wifi, WifiOff } from "lucide-react";
import { cn } from "../utils/classNames";

type ConnectionBadgeProps = {
  status: "connecting" | "connected" | "offline";
};

export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const online = status === "connected";
  const label = online ? "Connected" : status === "connecting" ? "Connecting" : "Offline";

  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-black",
        online ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-ember/50 bg-ember/10 text-red-100"
      )}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
