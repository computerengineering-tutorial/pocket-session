import React, { useEffect, useMemo, useState } from "react"
import {
  Clock,
  Layers,
  Sparkles,
} from "lucide-react"

import { ActiveTabCard } from "~components/ActiveTabCard"
import { Header } from "~components/Header"
import { ImportPreviewModal } from "~components/ImportPreviewModal"
import { PocketManagerModal } from "~components/PocketManagerModal"
import { QuickSwitcherModal } from "~components/QuickSwitcherModal"
import { RenameModal } from "~components/RenameModal"
import { SaveSessionModal } from "~components/SaveSessionModal"
import { SettingsModal } from "~components/SettingsModal"
import { WebsiteGroup } from "~components/WebsiteGroup"
import { SessionManager } from "~core/session-manager"
import type {
  ActiveTabInfo,
  CaptureOptions,
  ColorTag,
  PocketSettings,
  SessionPocket,
  SessionPocketStore,
} from "~types"

import "~style.css"

export default function IndexPopup() {
  const [vault, setVault] = useState<SessionPocketStore | null>(null)
  const [tabInfo, setTabInfo] = useState<ActiveTabInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Modals state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPocketManagerOpen, setIsPocketManagerOpen] = useState(false)
  const [importPreviewData, setImportPreviewData] = useState<{
    isOpen: boolean
    pockets: SessionPocket[]
    fileName: string
  } | null>(null)
  const [editingSession, setEditingSession] = useState<SessionPocket | null>(null)

  // Loading states
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  // Load vault and active tab info
  const loadData = async () => {
    try {
      const [loadedVault, currentTab] = await Promise.all([
        SessionManager.loadVault(),
        SessionManager.getActiveTabInfo()
      ])
      setVault(loadedVault)
      setTabInfo(currentTab)
    } catch (err) {
      console.error("Error loading popup data:", err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Keyboard shortcut listener for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIsQuickSwitcherOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Grouped websites
  const groups = useMemo(() => {
    if (!vault) return []
    const allGroups = SessionManager.getGroupedWebsites(vault)

    if (!searchQuery.trim()) return allGroups

    const q = searchQuery.toLowerCase()
    return allGroups
      .map((g) => ({
        ...g,
        sessions: g.sessions.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.domain.toLowerCase().includes(q) ||
            s.apexDomain.toLowerCase().includes(q) ||
            (s.notes && s.notes.toLowerCase().includes(q))
        )
      }))
      .filter((g) => g.sessions.length > 0 || g.displayName.toLowerCase().includes(q))
  }, [vault, searchQuery])

  // Total session count
  const totalSessions = useMemo(() => {
    if (!vault) return 0
    return Object.keys(vault.sessions).length
  }, [vault])

  // Count of sessions matching current tab's domain
  const activeDomainSessionCount = useMemo(() => {
    if (!vault || !tabInfo?.domain) return 0
    return Object.values(vault.sessions).filter(
      (s) => s.domain === tabInfo.domain || s.apexDomain === tabInfo.apexDomain
    ).length
  }, [vault, tabInfo])

  // Recently used sessions
  const recentSessions = useMemo(() => {
    if (!vault) return []
    return Object.values(vault.sessions)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, 3)
  }, [vault])

  // Handlers
  const handleSaveSession = async (
    name: string,
    tag: ColorTag,
    notes?: string,
    options?: Partial<CaptureOptions>
  ) => {
    setIsSaving(true)
    try {
      const saved = await SessionManager.saveCurrentSession({ name, tag, notes, options })
      await loadData()
      showNotification(`Saved "${saved.name}" successfully!`)
    } catch (err: any) {
      showNotification(err.message || "Failed to save session.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateSession = async (sessionId: string) => {
    setIsUpdating(true)
    try {
      const updated = await SessionManager.updateSession(sessionId)
      await loadData()
      showNotification(`Synced latest state for "${updated.name}"!`)
    } catch (err: any) {
      showNotification(err.message || "Failed to update session.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLaunchSession = async (
    sessionId: string,
    mode: "current-tab" | "new-tab" | "incognito"
  ) => {
    setIsLaunching(true)
    try {
      await SessionManager.launchSession(sessionId, mode)
      await loadData()
      const modeLabel =
        mode === "incognito"
          ? "isolated incognito window"
          : mode === "new-tab"
          ? "new tab"
          : "active tab"
      showNotification(`Launched session in ${modeLabel}!`)
    } catch (err: any) {
      showNotification(err.message || "Failed to launch session.")
    } finally {
      setIsLaunching(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (vault?.settings.confirmBeforeDelete) {
      const confirmed = window.confirm("Are you sure you want to delete this session pocket?")
      if (!confirmed) return
    }

    try {
      await SessionManager.deleteSession(sessionId)
      await loadData()
      showNotification("Session pocket deleted.")
    } catch (err: any) {
      showNotification(err.message || "Failed to delete session.")
    }
  }

  const handleRenameSession = async (
    sessionId: string,
    newName: string,
    newTag?: ColorTag,
    notes?: string
  ) => {
    try {
      await SessionManager.renameSession(sessionId, newName, newTag, notes)
      await loadData()
      showNotification("Session pocket updated.")
    } catch (err: any) {
      showNotification(err.message || "Failed to update session.")
    }
  }

  const handleExportSession = async (sessionId: string) => {
    try {
      const session = vault?.sessions[sessionId]
      if (!session) return
      const res = await SessionManager.exportSingleSession(sessionId, { format: "json" })
      SessionManager.downloadJsonFile(res.filename, res.jsonString)
      showNotification(`Exported "${session.name}" to JSON!`)
    } catch (err: any) {
      showNotification(err.message || "Failed to export pocket.")
    }
  }

  const handleExportDomain = async (domain: string) => {
    try {
      const res = await SessionManager.exportWebsiteGroup(domain, { format: "json" })
      SessionManager.downloadJsonFile(res.filename, res.jsonString)
      showNotification(`Exported pockets for ${domain}!`)
    } catch (err: any) {
      showNotification(err.message || "Failed to export website pockets.")
    }
  }

  const handleConfirmImport = async (
    selectedPockets: SessionPocket[],
    strategy: "overwrite" | "rename" | "skip"
  ) => {
    try {
      const res = await SessionManager.importPockets(selectedPockets, {
        conflictStrategy: strategy
      })
      await loadData()
      const total = res.importedCount + res.updatedCount
      showNotification(`Imported ${total} pocket${total === 1 ? "" : "s"} successfully!`)
    } catch (err: any) {
      showNotification(err.message || "Failed to import pockets.")
    }
  }

  const handleUpdateSettings = async (newSettings: Partial<PocketSettings>) => {
    try {
      await SessionManager.updateSettings(newSettings)
      await loadData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="w-[420px] min-h-[540px] max-h-[600px] bg-[#09090b] text-zinc-100 flex flex-col font-sans overflow-hidden antialiased select-none">
      {/* App Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenQuickSwitcher={() => setIsQuickSwitcherOpen(true)}
        onOpenManager={() => setIsPocketManagerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        sessionCount={totalSessions}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Toast / Notification banner */}
        {notification && (
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-zinc-100 text-xs font-medium text-center shadow-lg transition-all animate-in fade-in">
            {notification}
          </div>
        )}

        {/* Current Active Tab Context Card */}
        <ActiveTabCard
          tabInfo={tabInfo}
          domainSessionCount={activeDomainSessionCount}
          onOpenSaveModal={() => setIsSaveModalOpen(true)}
          onUpdateSession={handleUpdateSession}
          onExportSession={handleExportSession}
          onExportDomain={handleExportDomain}
          isUpdating={isUpdating}
        />

        {/* Quick Recently Used Chips (only if no active search) */}
        {!searchQuery && recentSessions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>Recently Used</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {recentSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleLaunchSession(s.id, "current-tab")}
                  disabled={isLaunching}
                  title={`Launch ${s.name} (${s.domain})`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-all shrink-0 max-w-[130px] cursor-pointer shadow-xs active:scale-95"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      s.tag === "emerald"
                        ? "bg-emerald-400"
                        : s.tag === "amber"
                        ? "bg-amber-400"
                        : s.tag === "rose"
                        ? "bg-rose-400"
                        : s.tag === "purple"
                        ? "bg-purple-400"
                        : s.tag === "cyan"
                        ? "bg-cyan-400"
                        : "bg-indigo-400"
                    }`}
                  />
                  <span className="truncate text-[11px] font-medium">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Saved Websites & Sessions List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
              {searchQuery ? "Search Results" : "Saved Website Pockets"}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPocketManagerOpen(true)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer font-sans"
              >
                Manage All →
              </button>
              <span className="text-[10px] font-mono text-zinc-400">
                {groups.length} site{groups.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="py-10 text-center space-y-2 rounded-xl border border-dashed border-zinc-800 bg-[#0c0c0f]/60 p-6">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-500">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-xs font-medium text-zinc-200">
                {searchQuery ? "No matching pockets found" : "No saved session pockets yet"}
              </div>
              <p className="text-[10px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {searchQuery
                  ? "Try searching for a different website name or profile tag."
                  : "Navigate to any website (e.g. WhatsApp, GitHub, Instagram) and click 'Save Pocket'."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <WebsiteGroup
                  key={group.domain}
                  group={group}
                  activeSessionId={vault?.activeSessions[group.domain]}
                  onLaunch={handleLaunchSession}
                  onUpdate={handleUpdateSession}
                  onRename={(s) => setEditingSession(s)}
                  onDelete={handleDeleteSession}
                  onExportSession={handleExportSession}
                  onExportGroup={handleExportDomain}
                  onAddSessionForGroup={(domain, url) => {
                    if (tabInfo?.domain !== domain && tabInfo?.apexDomain !== domain) {
                      const shouldOpen = window.confirm(
                        `You are currently viewing "${tabInfo?.domain || "a different page"}", but clicked to save a pocket for "${domain}".\n\nWould you like to open "${domain}" in a new tab first so you can log in and save its session?`
                      )
                      if (shouldOpen) {
                        chrome.tabs.create({ url: url || `https://${domain}` })
                        window.close()
                      }
                      return
                    }
                    setIsSaveModalOpen(true)
                  }}
                  isLaunching={isLaunching}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Status Bar */}
      <footer className="px-3.5 py-2 bg-[#09090b] border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-zinc-400 font-sans">Vault Ready</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPocketManagerOpen(true)}
            className="text-zinc-400 hover:text-indigo-300 font-sans cursor-pointer transition-colors"
          >
            Open Pocket Manager
          </button>
          <span>•</span>
          <span>⌘K to switch</span>
        </div>
      </footer>

      {/* Modals */}
      <SaveSessionModal
        isOpen={isSaveModalOpen}
        tabInfo={tabInfo}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveSession}
        isSaving={isSaving}
      />

      <RenameModal
        isOpen={Boolean(editingSession)}
        session={editingSession}
        onClose={() => setEditingSession(null)}
        onSave={handleRenameSession}
      />

      <QuickSwitcherModal
        isOpen={isQuickSwitcherOpen}
        sessions={vault ? Object.values(vault.sessions) : []}
        activeSessions={vault?.activeSessions || {}}
        onClose={() => setIsQuickSwitcherOpen(false)}
        onLaunch={handleLaunchSession}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={vault?.settings || { theme: "dark", autoSyncOnSwitch: true, confirmBeforeDelete: true, showActiveBadge: true }}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onDataImported={loadData}
      />

      {/* Full Pocket Manager Modal */}
      <PocketManagerModal
        isOpen={isPocketManagerOpen}
        vault={vault}
        onClose={() => setIsPocketManagerOpen(false)}
        onLaunch={handleLaunchSession}
        onRename={(s) => setEditingSession(s)}
        onUpdate={handleUpdateSession}
        onRefreshData={loadData}
        onOpenImportPreview={(pockets, fileName) => {
          setImportPreviewData({ isOpen: true, pockets, fileName })
        }}
        onNotification={showNotification}
      />

      {/* Import Preview & Conflict Resolution Modal */}
      {importPreviewData && (
        <ImportPreviewModal
          isOpen={importPreviewData.isOpen}
          pockets={importPreviewData.pockets}
          fileName={importPreviewData.fileName}
          existingSessions={vault?.sessions || {}}
          onClose={() => setImportPreviewData(null)}
          onConfirmImport={handleConfirmImport}
        />
      )}
    </div>
  )
}
