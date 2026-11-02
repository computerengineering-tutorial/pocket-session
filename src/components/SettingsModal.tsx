import React, { useRef, useState } from "react"
import {
  AlertTriangle,
  Download,
  Settings,
  ShieldCheck,
  Upload,
  X
} from "lucide-react"
import { SessionManager } from "~core/session-manager"
import type { PocketSettings } from "~types"

interface SettingsModalProps {
  isOpen: boolean
  settings: PocketSettings
  onClose: () => void
  onUpdateSettings: (newSettings: Partial<PocketSettings>) => Promise<void>
  onDataImported: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
  onDataImported
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await SessionManager.exportVault("json")
      SessionManager.downloadJsonFile(res.filename, res.jsonString)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const result = await SessionManager.importVault(buffer)
      setImportStatus(`Successfully imported ${result.importedCount} sessions!`)
      onDataImported()
      setTimeout(() => setImportStatus(null), 3000)
    } catch (err: any) {
      setImportStatus(err.message || "Failed to import file.")
      setTimeout(() => setImportStatus(null), 4000)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClearAll = async () => {
    await SessionManager.clearAllData()
    setShowClearConfirm(false)
    onDataImported()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-[#0c0c0f] border border-zinc-800 shadow-2xl p-4 text-zinc-100 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 flex items-center justify-center">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-100">Settings & Vault</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preferences */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Preferences
          </h4>

          <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 cursor-pointer hover:border-zinc-700 transition-colors">
            <div>
              <div className="text-xs font-medium text-zinc-200">Auto-sync on switch</div>
              <div className="text-[10px] text-zinc-400">
                Save active cookies & storage before switching
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSyncOnSwitch}
              onChange={(e) => onUpdateSettings({ autoSyncOnSwitch: e.target.checked })}
              className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-zinc-100 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-zinc-100"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 cursor-pointer hover:border-zinc-700 transition-colors">
            <div>
              <div className="text-xs font-medium text-zinc-200">Extension icon badge</div>
              <div className="text-[10px] text-zinc-400">
                Show active session dot on browser icon
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.showActiveBadge}
              onChange={(e) => onUpdateSettings({ showActiveBadge: e.target.checked })}
              className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-zinc-100 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-zinc-100"
            />
          </label>
        </div>

        {/* Backup & Restore */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Data & Backup
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-medium text-zinc-200 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isExporting ? "Exporting..." : "Export Vault"}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-medium text-zinc-200 transition-all active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Import Vault</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.spz,.gz"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {importStatus && (
            <div className="p-2 rounded-lg bg-zinc-950 text-xs text-center text-zinc-200 border border-zinc-800">
              {importStatus}
            </div>
          )}
        </div>

        {/* Privacy Note */}
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 flex items-start gap-2 text-[10px] text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-200">100% Local-First Architecture</span>
            <p className="mt-0.5 leading-relaxed">
              All credentials and cookies stay exclusively inside your browser's local sandbox. No external servers or telemetry.
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-2 border-t border-zinc-800/80">
          {showClearConfirm ? (
            <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-900/40 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Wipe all saved sessions?</span>
              </div>
              <p className="text-[10px] text-red-300/80">
                This will delete all saved profiles and cookies permanently.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 rounded-md text-[11px] text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-red-600 hover:bg-red-500 active:scale-95 cursor-pointer transition-all shadow-xs"
                >
                  Confirm Wipe
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full py-1 text-center text-[11px] text-red-400/80 hover:text-red-400 transition-colors cursor-pointer"
            >
              Clear All Data & Reset Vault
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
