import React from "react";
import { UserCheck, UserX } from "lucide-react";

interface PresenceBadgeProps {
  isOnScreen: boolean;
}

export default function PresenceBadge({ isOnScreen }: PresenceBadgeProps) {
  return (
    <span
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
        isOnScreen
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
      }`}
    >
      {isOnScreen ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
      {isOnScreen ? "CANDIDATE ON SCREEN" : "LEFT SCREEN / UNFOCUSED"}
    </span>
  );
}