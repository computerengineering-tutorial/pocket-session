import React, { useState } from "react"
import { Check, Cookie, Database, FileJson, HardDrive, Layers, X } from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import { getFaviconUrl } from "~lib/domain"
import { SessionManager } from "~core/session-manager"
import type { SessionPocket } from "~types"

interface ImportPreviewModalProps {
  isOpen: boolean
  pockets: SessionPocket[]
  fileName: string
  existingSessions: Record<string, SessionPocket>
  onClose: () => void
  onConfirmImport: (
    selectedPockets: SessionPocket[],
    strategy: "overwrite" | "rename" | "skip"
  ) => Promise<void>
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  pockets,
  fileName,
  existingSessions,
  onClose,
  onConfirmImport
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(pockets.map((p) => p.id))
  )
  const [strategy, setStrategy] = useState<"overwrite" | "rename" | "skip">("overwrite")
  const [isImporting, setIsImporting] = useState(false)

  if (!isOpen || pockets.length === 0) return null

  const isAllSelected = selectedIds.size === pockets.length && pockets.length > 0

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pockets.map((p) => p.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Count conflicts
  const conflictCount = pockets.filter((p) => {
    const hasSameId = Boolean(existingSessions[p.id])
    const hasSameName = Object.values(existingSessions).some(
      (s) =>
        s.domain === p.domain &&
        s.name.trim().toLowerCase() === p.name.trim().toLowerCase()
    )
    return hasSameId || hasSameName
  }).length

  const handleImport = async () => {
    const toImport = pockets.filter((p) => selectedIds.has(p.id))
    if (toImport.length === 0) return

    setIsImporting(true)
    try {
      await onConfirmImport(toImport, strategy)
      onClose()
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#0c0c0f] border border-zinc-800 shadow-2xl p-4 text-zinc-100 space-y-3.5 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400 flex items-center justify-center">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100">Import Session Pockets</h3>
              <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[260px]">
                {fileName} ({pockets.length} found)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Conflict Warning if duplicates found */}
        {conflictCount > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs shrink-0">
            <div className="font-semibold text-amber-300">
              {conflictCount} existing pocket{conflictCount > 1 ? "s" : ""} match this file.
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              <label
                className={`flex items-center gap-1.5 p-1.5 rounded-md border cursor-pointer text-[10px] transition-colors ${
                  strategy === "overwrite"
                    ? "bg-amber-500/20 border-amber-500/50 text-white font-medium"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="importStrategy"
                  checked={strategy === "overwrite"}
                  onChange={() => setStrategy("overwrite")}
                  className="hidden"
                />
                <span>Overwrite</span>
              </label>

              <label
                className={`flex items-center gap-1.5 p-1.5 rounded-md border cursor-pointer text-[10px] transition-colors ${
                  strategy === "rename"
                    ? "bg-amber-500/20 border-amber-500/50 text-white font-medium"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="importStrategy"
                  checked={strategy === "rename"}
                  onChange={() => setStrategy("rename")}
                  className="hidden"
                />
                <span>Keep Both (Copy)</span>
              </label>

              <label
                className={`flex items-center gap-1.5 p-1.5 rounded-md border cursor-pointer text-[10px] transition-colors ${
                  strategy === "skip"
                    ? "bg-amber-500/20 border-amber-500/50 text-white font-medium"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="importStrategy"
                  checked={strategy === "skip"}
                  onChange={() => setStrategy("skip")}
                  className="hidden"
                />
                <span>Skip Existing</span>
              </label>
            </div>
          </div>
        )}

        {/* Selection Toolbar */}
        <div className="flex items-center justify-between px-1 text-[11px] shrink-0">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-300 hover:text-white">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-indigo-500 cursor-pointer accent-indigo-500"
            />
            <span>Select All ({pockets.length})</span>
          </label>
          <span className="text-zinc-500 font-mono text-[10px]">
            {selectedIds.size} of {pockets.length} selected
          </span>
        </div>

        {/* Pockets List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[140px] max-h-[260px]">
          {pockets.map((pocket) => {
            const isSelected = selectedIds.has(pocket.id)
            const tagConfig = COLOR_TAGS[pocket.tag] || COLOR_TAGS.indigo
            const favicon = getFaviconUrl(pocket.domain, pocket.faviconUrl)
            const isDuplicate =
              Boolean(existingSessions[pocket.id]) ||
              Object.values(existingSessions).some(
                (s) =>
                  s.domain === pocket.domain &&
                  s.name.trim().toLowerCase() === pocket.name.trim().toLowerCase()
              )

            return (
              <div
                key={pocket.id}
                onClick={() => toggleSelect(pocket.id)}
                className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-zinc-900/90 border-zinc-700"
                    : "bg-zinc-950/60 border-zinc-850 hover:border-zinc-750 opacity-70"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleSelect(pocket.id)
                    }}
                    className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-indigo-500 cursor-pointer accent-indigo-500"
                  />

                  <div className="w-5 h-5 rounded bg-zinc-900 p-0.5 flex items-center justify-center shrink-0 border border-zinc-800">
                    <img
                      src={favicon}
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = "none"
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${tagConfig.dot} shrink-0`} />
                      <span className="text-xs font-medium text-zinc-100 truncate">
                        {pocket.name}
                      </span>
                      {isDuplicate && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono shrink-0">
                          Conflict
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                      {pocket.domain}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-300">
                    {SessionManager.calculatePocketSize(pocket).formattedTotal}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                    {pocket.cookies.length} cookies
                  </span>
                  {pocket.storage?.localStorage &&
                    Object.keys(pocket.storage.localStorage).length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                        Storage
                      </span>
                    )}
                  {pocket.idbSnapshot && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300">
                      IDB
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800/80 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || isImporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-indigo-400 hover:bg-indigo-300 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {isImporting
                ? "Importing..."
                : `Import ${selectedIds.size} Pocket${selectedIds.size === 1 ? "" : "s"}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

