// components/shared/Header.tsx
"use client";

import React, { useState } from "react";
import { Shield, Copy, Check, Link as LinkIcon } from "lucide-react";

interface HeaderProps {
  title: string;
  role: "proctor" | "candidate";
  badgeText: string;
  badgeType: "success" | "warning";
  roomId?: string;
}

export default function Header({ title, role, badgeText, badgeType, roomId }: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const candidateLink = typeof window !== "undefined" && roomId ? `${window.location.origin}/candidate?room=${roomId}` : "";

  const handleCopy = () => {
    if (candidateLink) {
      navigator.clipboard.writeText(candidateLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <Shield className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-lg font-bold text-white">{title}</h1>
          {roomId && (
            <p className="text-xs text-slate-400">
              Room ID: <span className="font-mono text-indigo-400">{roomId}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Candidate Link Box for Proctor */}
        {role === "proctor" && roomId && (
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 space-x-2">
            <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              readOnly
              value={candidateLink}
              className="bg-transparent text-xs text-slate-300 outline-none w-64 font-mono select-all"
            />
            <button
              onClick={handleCopy}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded transition-all"
              title="Copy Candidate Link"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            badgeType === "success"
              ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/50"
              : "bg-amber-950/50 text-amber-400 border border-amber-800/50"
          }`}
        >
          {badgeText}
        </span>
      </div>
    </header>
  );
}