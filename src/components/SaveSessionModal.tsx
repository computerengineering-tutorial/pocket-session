import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  Cookie,
  Database,
  HardDrive,
  Layers,
  Loader2,
  X
} from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import { SessionManager } from "~core/session-manager"
import type { ActiveTabInfo, CaptureOptions, ColorTag, StorageSizeEstimate } from "~types"

interface SaveSessionModalProps {
  isOpen: boolean
  tabInfo: ActiveTabInfo | null
  onClose: () => void
  onSave: (
    name: string,
    tag: ColorTag,
    notes?: string,
    options?: Partial<CaptureOptions>
  ) => Promise<void>
  isSaving: boolean
}

const TAG_OPTIONS: ColorTag[] = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "purple",
  "slate"
]

export const SaveSessionModal: React.FC<SaveSessionModalProps> = ({
  isOpen,
  tabInfo,
  onClose,
  onSave,
  isSaving
}) => {
  const [name, setName] = useState("")
  const [selectedTag, setSelectedTag] = useState<ColorTag>("indigo")
  const [notes, setNotes] = useState("")
  const [includeCookies, setIncludeCookies] = useState(true)
  const [includeLocalStorage, setIncludeLocalStorage] = useState(true)
  const [includeSessionStorage, setIncludeSessionStorage] = useState(true)
  const [includeIndexedDB, setIncludeIndexedDB] = useState(true)
  const [estimates, setEstimates] = useState<StorageSizeEstimate | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName("")
      setNotes("")
      setSelectedTag("indigo")
      setIncludeCookies(true)
      setIncludeLocalStorage(true)
      setIncludeSessionStorage(true)
      setIncludeIndexedDB(true)
      setEstimates(null)
      setTimeout(() => inputRef.current?.focus(), 50)

      if (tabInfo?.tabId && tabInfo?.domain) {
        setIsEstimating(true)
        const storeId = tabInfo.isIncognito ? "1" : "0"
        SessionManager.estimateStorageSizes(
          tabInfo.tabId,
          tabInfo.url,
          tabInfo.domain,
          tabInfo.apexDomain,
          storeId
        )
          .then((est) => {
            setEstimates(est)
            // Auto uncheck IndexedDB if unusually huge (> 15MB) to prevent unexpected bloating
            if (est.indexedDB.bytes > 15 * 1024 * 1024) {
              setIncludeIndexedDB(false)
            }
          })
          .catch((err) => console.warn("Estimate error:", err))
          .finally(() => setIsEstimating(false))
      }
    }
  }, [isOpen, tabInfo])

  const totalSelectedBytes = useMemo(() => {
    if (!estimates) return 0
    let total = 0
    if (includeCookies) total += estimates.cookies.bytes
    if (includeLocalStorage) total += estimates.localStorage.bytes
    if (includeSessionStorage) total += estimates.sessionStorage.bytes
    if (includeIndexedDB) total += estimates.indexedDB.bytes
    return total
  }, [estimates, includeCookies, includeLocalStorage, includeSessionStorage, includeIndexedDB])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isSaving) return
    await onSave(name.trim(), selectedTag, notes.trim() || undefined, {
      includeCookies,
      includeLocalStorage,
      includeSessionStorage,
      includeIndexedDB
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-sm rounded-xl bg-[#0c0c0f] border border-zinc-800 shadow-2xl p-4 text-zinc-100 space-y-3 max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 flex items-center justify-center">
              <BookmarkPlus className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100">Save Session Pocket</h3>
              <p className="text-[10px] font-mono text-zinc-400 truncate max-w-[190px]">
                {tabInfo?.domain || "Current website"}
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

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Pocket Name
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work Account, Personal, Alt #1"
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
              Color Tag
            </label>
            <div className="flex items-center gap-2">
              {TAG_OPTIONS.map((tag) => {
                const config = COLOR_TAGS[tag]
                const isSelected = selectedTag === tag
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    title={config.label}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      config.dot
                    } ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2FA enabled, staging credentials"
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
            />
          </div>

          {/* Selective Storage Snapshot with live MB/KB indicators */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-200">What to save in this pocket:</span>
              <span className="text-[10px] font-mono text-indigo-300 font-medium">
                {isEstimating ? (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>Calculating...</span>
                  </span>
                ) : (
                  `~${SessionManager.formatBytes(totalSelectedBytes)}`
                )}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              {/* Cookies */}
              <label className="flex items-center justify-between p-1.5 rounded-md bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeCookies}
                    onChange={(e) => setIncludeCookies(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-200">
                    <Cookie className="w-3 h-3 text-amber-400" />
                    <span>Cookies & Auth Tokens</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {estimates ? `${estimates.cookies.count} (${SessionManager.formatBytes(estimates.cookies.bytes)})` : "..."}
                </span>
              </label>

              {/* LocalStorage */}
              <label className="flex items-center justify-between p-1.5 rounded-md bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeLocalStorage}
                    onChange={(e) => setIncludeLocalStorage(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-200">
                    <HardDrive className="w-3 h-3 text-cyan-400" />
                    <span>LocalStorage</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {estimates ? `${estimates.localStorage.count} keys (${SessionManager.formatBytes(estimates.localStorage.bytes)})` : "..."}
                </span>
              </label>

              {/* SessionStorage */}
              <label className="flex items-center justify-between p-1.5 rounded-md bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeSessionStorage}
                    onChange={(e) => setIncludeSessionStorage(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-200">
                    <Layers className="w-3 h-3 text-purple-400" />
                    <span>SessionStorage</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {estimates ? `${estimates.sessionStorage.count} keys (${SessionManager.formatBytes(estimates.sessionStorage.bytes)})` : "..."}
                </span>
              </label>

              {/* IndexedDB */}
              <label className="flex items-center justify-between p-1.5 rounded-md bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeIndexedDB}
                    onChange={(e) => setIncludeIndexedDB(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-200">
                    <Database className="w-3 h-3 text-emerald-400" />
                    <span>IndexedDB (Databases)</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {estimates
                    ? estimates.indexedDB.count > 0
                      ? `${estimates.indexedDB.count} dbs (~${SessionManager.formatBytes(estimates.indexedDB.bytes)})`
                      : "0 B"
                    : "..."}
                </span>
              </label>
            </div>

            {estimates && estimates.indexedDB.bytes > 5 * 1024 * 1024 && (
              <div className="flex items-start gap-1.5 p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  IndexedDB is large ({SessionManager.formatBytes(estimates.indexedDB.bytes)}). Uncheck it if you want a lighter pocket.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Pocket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
