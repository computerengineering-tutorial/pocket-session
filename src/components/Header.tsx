import React from "react"
import { FolderKanban, Layers, Search, Settings, X, Zap } from "lucide-react"

interface HeaderProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  onOpenQuickSwitcher: () => void
  onOpenManager: () => void
  onOpenSettings: () => void
  sessionCount: number
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenQuickSwitcher,
  onOpenManager,
  onOpenSettings,
  sessionCount
}) => {
  return (
    <header className="px-3.5 py-3 bg-[#09090b] border-b border-zinc-800/80 sticky top-0 z-30 flex flex-col gap-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 flex items-center justify-center shadow-xs">
            <Layers className="w-3.5 h-3.5 text-zinc-100" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-semibold text-zinc-50 tracking-tight">SessionPocket</h1>
              <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                MV3
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">One browser. Isolated profiles.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenQuickSwitcher}
            title="Quick Switcher (⌘K / Ctrl+K)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[11px]">Switch</span>
            <kbd className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
              ⌘K
            </kbd>
          </button>
          <button
            onClick={onOpenManager}
            title="Pocket Manager (Multi-Select & Export)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <FolderKanban className="w-3 h-3 text-indigo-400" />
            <span className="text-[11px]">Manage</span>
          </button>
          <button
            onClick={onOpenSettings}
            title="Settings & Backup"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 border border-transparent hover:border-zinc-800 transition-all active:scale-95 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Filter ${sessionCount} pocket${sessionCount === 1 ? "" : "s"} or website...`}
          className="w-full pl-8 pr-7 py-1.5 bg-zinc-900/90 hover:bg-zinc-900 focus:bg-zinc-950 text-xs text-zinc-100 placeholder:text-zinc-500 rounded-lg border border-zinc-800 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600/50 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 p-0.5 text-zinc-500 hover:text-zinc-200 rounded hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </header>
  )
}
