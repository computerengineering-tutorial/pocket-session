import React, { useState } from "react"
import { ChevronDown, ChevronRight, Download, Plus } from "lucide-react"
import { getFaviconUrl, getWebsiteDisplayName } from "~lib/domain"
import type { SessionPocket, WebsiteGroup as WebsiteGroupType } from "~types"
import { SessionItem } from "./SessionItem"

interface WebsiteGroupProps {
  group: WebsiteGroupType
  activeSessionId?: string
  onLaunch: (sessionId: string, mode: "current-tab" | "new-tab" | "incognito") => void
  onUpdate: (sessionId: string) => void
  onRename: (session: SessionPocket) => void
  onDelete: (sessionId: string) => void
  onExportSession: (sessionId: string) => void
  onExportGroup: (domain: string) => void
  onAddSessionForGroup: (domain: string, url: string) => void
  isLaunching: boolean
}

export const WebsiteGroup: React.FC<WebsiteGroupProps> = ({
  group,
  activeSessionId,
  onLaunch,
  onUpdate,
  onRename,
  onDelete,
  onExportSession,
  onExportGroup,
  onAddSessionForGroup,
  isLaunching
}) => {
  const [isOpen, setIsOpen] = useState(true)

  const displayName = getWebsiteDisplayName(group.domain, group.apexDomain)
  const favicon = getFaviconUrl(group.domain, group.faviconUrl)

  return (
    <div className="rounded-xl bg-[#0c0c0f] border border-zinc-800/80 overflow-hidden shadow-xs">
      {/* Website Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-900/80 cursor-pointer select-none transition-colors border-b border-zinc-800/60"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <div className="w-4 h-4 rounded bg-zinc-850 p-0.5 flex items-center justify-center shrink-0">
            <img
              src={favicon}
              alt=""
              className="w-3.5 h-3.5 object-contain"
              onError={(e) => {
                ;(e.target as HTMLElement).style.display = "none"
              }}
            />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-zinc-100 truncate">{displayName}</span>
            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[140px]">{group.domain}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-medium border border-zinc-800">
            {group.sessions.length} {group.sessions.length === 1 ? "pocket" : "pockets"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onExportGroup(group.domain)
            }}
            title={`Export all ${group.sessions.length} pocket(s) for ${group.domain} as JSON`}
            className="p-1 rounded-md text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 border border-transparent hover:border-zinc-700/60 transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddSessionForGroup(group.domain, group.sessions[0]?.url || `https://${group.domain}`)
            }}
            title="Save new session for this site"
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent hover:border-zinc-700/60 transition-all cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Session Pockets List */}
      {isOpen && (
        <div className="p-2 space-y-1.5">
          {group.sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={activeSessionId === session.id}
              onLaunch={onLaunch}
              onUpdate={onUpdate}
              onRename={onRename}
              onDelete={onDelete}
              onExport={onExportSession}
              isLaunching={isLaunching}
            />
          ))}
        </div>
      )}
    </div>
  )
}
