import React from "react"
import { BookmarkPlus, Download, Globe, RefreshCw } from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import { getWebsiteDisplayName } from "~lib/domain"
import type { ActiveTabInfo } from "~types"

interface ActiveTabCardProps {
  tabInfo: ActiveTabInfo | null
  domainSessionCount?: number
  onOpenSaveModal: () => void
  onUpdateSession: (sessionId: string) => void
  onExportSession?: (sessionId: string) => void
  onExportDomain?: (domain: string) => void
  isUpdating: boolean
}

export const ActiveTabCard: React.FC<ActiveTabCardProps> = ({
  tabInfo,
  domainSessionCount = 0,
  onOpenSaveModal,
  onUpdateSession,
  onExportSession,
  onExportDomain,
  isUpdating
}) => {
  if (!tabInfo || !tabInfo.domain) {
    return (
      <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/70 text-center">
        <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs font-medium">
          <Globe className="w-3.5 h-3.5 text-zinc-500" />
          <span>Open a website to save or isolate sessions</span>
        </div>
        <p className="text-[10px] text-zinc-400 mt-0.5">
          Works seamlessly with WhatsApp, Google, Instagram, GitHub & any web app.
        </p>
      </div>
    )
  }

  const siteName = getWebsiteDisplayName(tabInfo.domain, tabInfo.apexDomain)
  const activeSession = tabInfo.activeSession
  const tagConfig = activeSession ? COLOR_TAGS[activeSession.tag] || COLOR_TAGS.indigo : null

  return (
    <div className="p-3 bg-[#0d0d10] rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 p-1 flex items-center justify-center shrink-0">
            <img
              src={tabInfo.faviconUrl}
              alt=""
              className="w-4 h-4 object-contain"
              onError={(e) => {
                ;(e.target as HTMLElement).style.display = "none"
              }}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-100 truncate">{siteName}</span>
              <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[120px]">
                {tabInfo.domain}
              </span>
            </div>

            {activeSession ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${tagConfig?.dot || "bg-emerald-400"} animate-pulse shrink-0`} />
                <span className="text-[11px] text-zinc-300 font-medium truncate">
                  Active: <strong className="text-white font-semibold">{activeSession.name}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                <span className="text-[11px] text-zinc-400">
                  {domainSessionCount > 0
                    ? `${domainSessionCount} pocket${domainSessionCount > 1 ? "s" : ""} saved`
                    : "Default profile session"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeSession ? (
            <>
              <button
                onClick={() => onUpdateSession(activeSession.id)}
                disabled={isUpdating}
                title="Sync latest cookies and storage to this pocket"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3 h-3 text-zinc-400 ${isUpdating ? "animate-spin" : ""}`} />
                <span className="text-[11px]">Sync</span>
              </button>

              <button
                onClick={() => onExportSession?.(activeSession.id)}
                title={`Export "${activeSession.name}" pocket as JSON`}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Download className="w-3 h-3 text-indigo-400" />
                <span className="text-[11px]">Export JSON</span>
              </button>
            </>
          ) : domainSessionCount > 0 && onExportDomain ? (
            <button
              onClick={() => onExportDomain(tabInfo.domain)}
              title={`Export all ${domainSessionCount} pocket(s) for ${tabInfo.domain} as JSON`}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Download className="w-3 h-3 text-indigo-400" />
              <span className="text-[11px]">Export Site</span>
            </button>
          ) : null}

          <button
            onClick={onOpenSaveModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <BookmarkPlus className="w-3 h-3 text-zinc-900" />
            <span className="text-[11px]">Save Pocket</span>
          </button>
        </div>
      </div>
    </div>
  )
}
