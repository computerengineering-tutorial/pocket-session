import type { ColorTag, PocketSettings } from "~types"

export const COLOR_TAGS: Record<
  ColorTag,
  { label: string; bg: string; text: string; border: string; ring: string; dot: string; badge: string }
> = {
  indigo: {
    label: "Indigo",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
    ring: "focus:ring-indigo-500",
    dot: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]",
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
  },
  emerald: {
    label: "Emerald",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    ring: "focus:ring-emerald-500",
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  },
  amber: {
    label: "Amber",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    ring: "focus:ring-amber-500",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30"
  },
  rose: {
    label: "Rose",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
    ring: "focus:ring-rose-500",
    dot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30"
  },
  cyan: {
    label: "Cyan",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
    ring: "focus:ring-cyan-500",
    dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
  },
  purple: {
    label: "Purple",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
    ring: "focus:ring-purple-500",
    dot: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.5)]",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30"
  },
  slate: {
    label: "Slate",
    bg: "bg-zinc-500/10",
    text: "text-zinc-300",
    border: "border-zinc-500/30",
    ring: "focus:ring-zinc-400",
    dot: "bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.5)]",
    badge: "bg-zinc-800 text-zinc-300 border-zinc-700"
  }
}

export const DEFAULT_SETTINGS: PocketSettings = {
  theme: "dark",
  autoSyncOnSwitch: true,
  confirmBeforeDelete: true,
  showActiveBadge: true
}

export const STORAGE_VAULT_KEY = "sessionpocket_vault_v1"
