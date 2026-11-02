import React, { useRef, useState } from "react"
import {
  Clock,
  Download,
  ExternalLink,
  MoreVertical,
  Pencil,
  Play,
  RefreshCw,
  Shield,
  Trash2
} from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import type { SessionPocket } from "~types"

interface SessionItemProps {
  session: SessionPocket
  isActive: boolean
  onLaunch: (sessionId: string, mode: "current-tab" | "new-tab" | "incognito") => void
  onUpdate: (sessionId: string) => void
  onRename: (session: SessionPocket) => void
  onDelete: (sessionId: string) => void
  onExport: (sessionId: string) => void
  isLaunching: boolean
}

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onLaunch,
  onUpdate,
  onRename,
  onDelete,
  onExport,
  isLaunching
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const tagConfig = COLOR_TAGS[session.tag] || COLOR_TAGS.indigo

  const formatTime = (epoch: number) => {
    const diffSec = Math.floor((Date.now() - epoch) / 1000)
    if (diffSec < 60) return "Just now"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
  }

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect()
      setOpenUpward(rect.bottom > window.innerHeight - 170)
    }
    setShowMenu(!showMenu)
  }

  const cookieCount = session.cookies?.length || 0
  const hasLS = session.storage?.localStorage && Object.keys(session.storage.localStorage).length > 0
  const hasIDB = Boolean(session.idbSnapshot)

  return (
    <div
      className={`group relative rounded-lg px-2.5 py-2 transition-all border ${
        isActive
          ? "bg-zinc-900/90 border-zinc-700 shadow-xs"
          : "bg-[#09090b] hover:bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-750"
      }`}
    >
      {/* Top Row: Color Tag, Session Name, Active status, and Primary Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Color Indicator Dot */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${tagConfig.dot}`} />

          <span className="text-xs font-medium text-zinc-100 truncate">
            {session.name}
          </span>

          {isActive && (
            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
              Active
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Launch in Current Tab */}
          <button
            onClick={() => onLaunch(session.id, "current-tab")}
            disabled={isLaunching}
            title="Launch session into current tab"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-zinc-950 bg-zinc-100 hover:bg-white active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            <span>Launch</span>
          </button>

          {/* Launch in Isolated / Incognito Window */}
          <button
            onClick={() => onLaunch(session.id, "incognito")}
            disabled={isLaunching}
            title="Launch isolated in Incognito Window"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Shield className="w-3 h-3 text-zinc-400" />
            <span>Incognito</span>
          </button>

          {/* More Actions Menu Button */}
          <div className="relative">
            <button
              ref={menuButtonRef}
              onClick={toggleMenu}
              title="More options"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent hover:border-zinc-750 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className={`absolute right-0 ${
                    openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
                  } w-44 rounded-lg bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl shadow-black/90 py-1 z-50`}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onLaunch(session.id, "new-tab")
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Open in New Tab</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onUpdate(session.id)
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Sync Current Tab</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onRename(session)
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Rename & Tag</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onExport(session.id)
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Export Pocket (JSON)</span>
                  </button>

                  <div className="my-1 border-t border-zinc-800/80" />

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onDelete(session.id)
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Delete Pocket</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Metadata Chips & Notes */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 mt-1.5 pt-1.5 border-t border-zinc-800/40">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-zinc-400 font-mono">
            <Clock className="w-2.5 h-2.5 text-zinc-400" />
            {formatTime(session.lastUsedAt)}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[9px]">
            {cookieCount} cookies
          </span>
          {hasLS && (
            <span className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[9px]">
              Storage
            </span>
          )}
          {hasIDB && (
            <span className="px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 font-mono text-[9px]">
              IDB
            </span>
          )}
        </div>

        {session.notes && (
          <span
            className="text-zinc-400 text-[10px] italic truncate max-w-[130px]"
            title={session.notes}
          >
            {session.notes}
          </span>
        )}
      </div>
    </div>
  )
}
