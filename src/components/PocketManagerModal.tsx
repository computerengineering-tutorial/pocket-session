import React, { useMemo, useRef, useState } from "react"
import {
  Archive,
  CheckSquare,
  Clock,
  Cookie,
  Database,
  Download,
  ExternalLink,
  Filter,
  FolderKanban,
  HardDrive,
  Layers,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Square,
  Trash2,
  Upload,
  X,
  Zap
} from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import { getFaviconUrl, getWebsiteDisplayName } from "~lib/domain"
import { SessionManager } from "~core/session-manager"
import type {
  ColorTag,
  ExportFilterOptions,
  ExportFormat,
  SessionPocket,
  SessionPocketStore
} from "~types"

interface PocketManagerModalProps {
  isOpen: boolean
  vault: SessionPocketStore | null
  onClose: () => void
  onLaunch: (sessionId: string, mode: "current-tab" | "new-tab" | "incognito") => void
  onRename: (session: SessionPocket) => void
  onUpdate: (sessionId: string) => void
  onRefreshData: () => Promise<void>
  onOpenImportPreview: (pockets: SessionPocket[], fileName: string) => void
  onNotification: (msg: string) => void
}

export const PocketManagerModal: React.FC<PocketManagerModalProps> = ({
  isOpen,
  vault,
  onClose,
  onLaunch,
  onRename,
  onUpdate,
  onRefreshData,
  onOpenImportPreview,
  onNotification
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [selectedDomain, setSelectedDomain] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showExportOptions, setShowExportOptions] = useState(false)

  // Export customization
  const [exportFormat, setExportFormat] = useState<ExportFormat>("spz")
  const [exportIncludeCookies, setExportIncludeCookies] = useState(true)
  const [exportIncludeStorage, setExportIncludeStorage] = useState(true)
  const [exportIncludeIndexedDB, setExportIncludeIndexedDB] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const allSessions: SessionPocket[] = useMemo(() => {
    if (!vault) return []
    return Object.values(vault.sessions).sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  }, [vault])

  // Unique domains for filtering
  const uniqueDomains = useMemo(() => {
    const set = new Set<string>()
    for (const s of allSessions) {
      set.add(s.domain)
    }
    return Array.from(set).sort()
  }, [allSessions])

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return allSessions.filter((s) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = s.name.toLowerCase().includes(q)
        const matchesDomain = s.domain.toLowerCase().includes(q)
        const matchesNotes = Boolean(s.notes && s.notes.toLowerCase().includes(q))
        if (!matchesName && !matchesDomain && !matchesNotes) return false
      }

      // Domain filter
      if (selectedDomain !== "all" && s.domain !== selectedDomain) {
        return false
      }

      // Tag filter
      if (selectedTag !== "all" && s.tag !== selectedTag) {
        return false
      }

      return true
    })
  }, [allSessions, searchQuery, selectedDomain, selectedTag])

  if (!isOpen) return null

  // Selection helpers
  const isAllFilteredSelected =
    filteredSessions.length > 0 &&
    filteredSessions.every((s) => selectedIds.has(s.id))

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const s of filteredSessions) {
          next.delete(s.id)
        }
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const s of filteredSessions) {
          next.add(s.id)
        }
        return next
      })
    }
  }

  const toggleSelectOne = (id: string) => {
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

  // Export selected pockets
  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return
    setIsExporting(true)
    try {
      const ids = Array.from(selectedIds)
      const filterOpts: Partial<ExportFilterOptions> = {
        format: exportFormat,
        includeCookies: exportIncludeCookies,
        includeStorage: exportIncludeStorage,
        includeIndexedDB: exportIncludeIndexedDB
      }

      const res = await SessionManager.exportSessions(ids, filterOpts)
      if (res.format === "spz" && res.compressedData) {
        SessionManager.downloadCompressedFile(res.filename, res.compressedData)
        onNotification(`Exported ${ids.length} pocket(s) in compressed .spz format!`)
      } else {
        SessionManager.downloadJsonFile(res.filename, res.jsonString)
        onNotification(`Exported ${ids.length} pocket(s) to JSON!`)
      }
    } catch (err: any) {
      onNotification(err.message || "Failed to export selected pockets.")
    } finally {
      setIsExporting(false)
    }
  }

  // Export single pocket
  const handleExportSingle = async (session: SessionPocket, forceFormat?: ExportFormat) => {
    try {
      const formatToUse = forceFormat || exportFormat
      const filterOpts: Partial<ExportFilterOptions> = {
        format: formatToUse,
        includeCookies: exportIncludeCookies,
        includeStorage: exportIncludeStorage,
        includeIndexedDB: exportIncludeIndexedDB
      }

      const res = await SessionManager.exportSingleSession(session.id, filterOpts)
      if (res.format === "spz" && res.compressedData) {
        SessionManager.downloadCompressedFile(res.filename, res.compressedData)
        onNotification(`Exported "${session.name}" as compressed .spz!`)
      } else {
        SessionManager.downloadJsonFile(res.filename, res.jsonString)
        onNotification(`Exported "${session.name}" as JSON!`)
      }
    } catch (err: any) {
      onNotification(err.message || "Failed to export pocket.")
    }
  }

  // Bulk delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    const count = selectedIds.size
    const confirmed = window.confirm(
      `Are you sure you want to delete ${count} selected session pocket${count === 1 ? "" : "s"}?`
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const deleted = await SessionManager.deleteMultipleSessions(Array.from(selectedIds))
      setSelectedIds(new Set())
      await onRefreshData()
      onNotification(`Deleted ${deleted} session pocket${deleted === 1 ? "" : "s"}.`)
    } catch (err: any) {
      onNotification(err.message || "Failed to delete selected pockets.")
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle single delete
  const handleDeleteSingle = async (session: SessionPocket) => {
    const confirmed = window.confirm(`Delete pocket "${session.name}" (${session.domain})?`)
    if (!confirmed) return

    try {
      await SessionManager.deleteSession(session.id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(session.id)
        return next
      })
      await onRefreshData()
      onNotification(`Pocket "${session.name}" deleted.`)
    } catch (err: any) {
      onNotification(err.message || "Failed to delete session.")
    }
  }

  // File import picker (handles both .json AND binary .spz / .gz)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const parsed = await SessionManager.parseImportPayload(buffer)
      if (!parsed.success || !parsed.sessions) {
        onNotification(parsed.error || "Invalid backup file.")
        return
      }

      onOpenImportPreview(parsed.sessions, file.name)
    } catch (err: any) {
      onNotification(err.message || "Failed to read file.")
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 bg-black/85 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#09090b] border border-zinc-800 shadow-2xl p-4 text-zinc-100 flex flex-col max-h-[94vh] h-[580px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400 flex items-center justify-center shadow-xs">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-zinc-100">Pocket Manager</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {allSessions.length} total
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Multi-select export, storage size metrics & .spz compressed archives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Import Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import pockets from .spz or .json file"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Upload className="w-3 h-3 text-indigo-400" />
              <span className="text-[11px]">Import File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.spz,.gz"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="py-2 space-y-2 shrink-0 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by pocket name, website, notes..."
                className="w-full pl-8 pr-7 py-1.5 bg-zinc-900/90 hover:bg-zinc-900 focus:bg-zinc-950 text-xs text-zinc-100 placeholder:text-zinc-500 rounded-lg border border-zinc-800 focus:border-zinc-700 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Domain Dropdown */}
            {uniqueDomains.length > 1 && (
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="all">All Domains</option>
                {uniqueDomains.map((dom) => (
                  <option key={dom} value={dom}>
                    {dom}
                  </option>
                ))}
              </select>
            )}

            {/* Export Settings Toggle */}
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              title="Export Settings & Storage Filters"
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                showExportOptions
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color Tag Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
            <span className="text-zinc-500 font-mono text-[9px] mr-1">TAG:</span>
            <button
              onClick={() => setSelectedTag("all")}
              className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                selectedTag === "all"
                  ? "bg-zinc-800 text-white border-zinc-650 font-medium"
                  : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-750"
              }`}
            >
              All
            </button>
            {Object.keys(COLOR_TAGS).map((tagKey) => {
              const tagConfig = COLOR_TAGS[tagKey as ColorTag]
              const isSelected = selectedTag === tagKey
              return (
                <button
                  key={tagKey}
                  onClick={() => setSelectedTag(tagKey)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors cursor-pointer capitalize ${
                    isSelected
                      ? "bg-zinc-800 text-white border-zinc-650 font-medium"
                      : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-750"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tagConfig.dot}`} />
                  <span>{tagConfig.label}</span>
                </button>
              )
            })}
          </div>

          {/* Collapsible Export Format & Storage Filters */}
          {showExportOptions && (
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200 text-[11px]">
                  Export Format & Storage Optimization:
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {exportFormat === "spz" ? "⚡ Gzip Compressed (70-90% smaller)" : "Plain Text JSON"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label
                  className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors ${
                    exportFormat === "spz"
                      ? "bg-indigo-500/15 border-indigo-500/40 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="expFormat"
                    checked={exportFormat === "spz"}
                    onChange={() => setExportFormat("spz")}
                    className="hidden"
                  />
                  <Archive className="w-3.5 h-3.5 text-indigo-400" />
                  <div>
                    <div className="font-medium">.spz (Compressed)</div>
                    <div className="text-[9px] text-zinc-500">Compact gzip binary archive</div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors ${
                    exportFormat === "json"
                      ? "bg-indigo-500/15 border-indigo-500/40 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="expFormat"
                    checked={exportFormat === "json"}
                    onChange={() => setExportFormat("json")}
                    className="hidden"
                  />
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <div className="font-medium">.json (Plain)</div>
                    <div className="text-[9px] text-zinc-500">Uncompressed JSON text</div>
                  </div>
                </label>
              </div>

              {/* Selective components to include in export */}
              <div className="pt-1.5 border-t border-zinc-850 flex items-center justify-between gap-2 text-[10px]">
                <span className="text-zinc-500">Include in export:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={exportIncludeCookies}
                      onChange={(e) => setExportIncludeCookies(e.target.checked)}
                      className="w-3 h-3 rounded bg-zinc-900 border-zinc-700 accent-indigo-500"
                    />
                    <span>Cookies</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={exportIncludeStorage}
                      onChange={(e) => setExportIncludeStorage(e.target.checked)}
                      className="w-3 h-3 rounded bg-zinc-900 border-zinc-700 accent-indigo-500"
                    />
                    <span>Storage</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={exportIncludeIndexedDB}
                      onChange={(e) => setExportIncludeIndexedDB(e.target.checked)}
                      className="w-3 h-3 rounded bg-zinc-900 border-zinc-700 accent-indigo-500"
                    />
                    <span>IndexedDB</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Selection Bar */}
        <div className="py-2 px-1 flex items-center justify-between text-xs bg-zinc-900/40 rounded-lg my-1 border border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-white font-medium cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-400" />
              ) : (
                <Square className="w-4 h-4 text-zinc-500" />
              )}
              <span className="text-[11px]">
                {isAllFilteredSelected ? "Deselect All" : "Select All"} (
                {filteredSessions.length})
              </span>
            </button>

            {selectedIds.size > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportSelected}
                disabled={isExporting}
                title={`Export selected pockets in .${exportFormat} format`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-zinc-950 bg-indigo-400 hover:bg-indigo-300 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3 h-3" />
                <span>
                  Export ({selectedIds.size}) {exportFormat === "spz" ? "(.spz)" : "(.json)"}
                </span>
              </button>

              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                title="Delete selected pockets"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-red-300 hover:text-red-200 bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1 cursor-pointer"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-zinc-500">
              Select pockets to batch export or delete
            </span>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-zinc-800/80 rounded-xl bg-zinc-950/40 p-4">
              <FolderKanban className="w-6 h-6 text-zinc-600 mx-auto" />
              <div className="text-xs font-medium text-zinc-300">No session pockets match</div>
              <p className="text-[10px] text-zinc-500 max-w-xs mx-auto">
                {searchQuery || selectedDomain !== "all" || selectedTag !== "all"
                  ? "Try resetting your search query or tag filters."
                  : "Save your first session pocket from the active tab!"}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = selectedIds.has(session.id)
              const tagConfig = COLOR_TAGS[session.tag] || COLOR_TAGS.indigo
              const favicon = getFaviconUrl(session.domain, session.faviconUrl)
              const isActive = vault?.activeSessions[session.domain] === session.id
              const sizeInfo = SessionManager.calculatePocketSize(session)

              return (
                <div
                  key={session.id}
                  className={`group rounded-xl p-2.5 transition-all border ${
                    isSelected
                      ? "bg-zinc-900/90 border-indigo-500/40 shadow-xs"
                      : "bg-[#0c0c0f] hover:bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-750"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelectOne(session.id)}
                        className="text-zinc-400 hover:text-white cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                        )}
                      </button>

                      {/* Favicon */}
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

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${tagConfig.dot} shrink-0`} />
                          <span className="text-xs font-semibold text-zinc-100 truncate">
                            {session.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                              Active
                            </span>
                          )}
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0"
                            title={`Cookies: ${SessionManager.formatBytes(sizeInfo.cookiesBytes)} | Storage: ${SessionManager.formatBytes(sizeInfo.storageBytes)} | IndexedDB: ${SessionManager.formatBytes(sizeInfo.idbBytes)}`}
                          >
                            {sizeInfo.formattedTotal}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                          <span className="truncate max-w-[130px]">{session.domain}</span>
                          <span>•</span>
                          <span>{session.cookies?.length || 0} cookies</span>
                          {session.idbSnapshot && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-300">IDB</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatTime(session.lastUsedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Export Single */}
                      <button
                        onClick={() => handleExportSingle(session)}
                        title={`Export "${session.name}" (${exportFormat.toUpperCase()})`}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Launch Current Tab */}
                      <button
                        onClick={() => onLaunch(session.id, "current-tab")}
                        title="Launch in current tab"
                        className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>

                      {/* Launch Incognito */}
                      <button
                        onClick={() => onLaunch(session.id, "incognito")}
                        title="Launch isolated in Incognito"
                        className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>

                      {/* Rename / Edit */}
                      <button
                        onClick={() => onRename(session)}
                        title="Rename & Tag"
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteSingle(session)}
                        title="Delete pocket"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-900/40 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {session.notes && (
                    <div className="text-[10px] text-zinc-500 italic mt-1 pl-7 truncate">
                      "{session.notes}"
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500 shrink-0">
          <span>
            Showing {filteredSessions.length} of {allSessions.length} pockets
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const res = await SessionManager.exportVault("spz")
                if (res.compressedData) {
                  SessionManager.downloadCompressedFile(res.filename, res.compressedData)
                  onNotification("Exported full vault as compressed .spz archive!")
                }
              }}
              className="text-zinc-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Archive className="w-3 h-3 text-indigo-400" />
              <span>Export Vault (.spz)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
