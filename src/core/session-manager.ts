import { DEFAULT_SETTINGS, STORAGE_VAULT_KEY } from "~lib/constants"
import { getApexDomain, getFaviconUrl, getWebsiteDisplayName, parseUrl } from "~lib/domain"
import {
  ExportDataSchema,
  FlexibleImportSchema,
  SessionPocketSchema,
  SessionPocketStoreSchema
} from "~lib/schema"
import type {
  ActiveTabInfo,
  CaptureOptions,
  ColorTag,
  ExportFilterOptions,
  ExportFormat,
  PocketSettings,
  SessionPocket,
  SessionPocketStore,
  StorageSizeEstimate,
  WebsiteGroup
} from "~types"
import { CookieEngine } from "./cookie-engine"
import { IDBEngine } from "./idb-engine"
import { StorageEngine } from "./storage-engine"

export class SessionManager {
  /**
   * Load the SessionPocket store from chrome.storage.local
   */
  static async loadVault(): Promise<SessionPocketStore> {
    const fallback: SessionPocketStore = {
      version: 1,
      sessions: {},
      activeSessions: {},
      settings: { ...DEFAULT_SETTINGS }
    }

    if (!chrome?.storage?.local) return fallback

    try {
      const data = await chrome.storage.local.get(STORAGE_VAULT_KEY)
      const rawStore = data[STORAGE_VAULT_KEY]
      if (!rawStore) return fallback

      const parsed = SessionPocketStoreSchema.safeParse(rawStore)
      if (parsed.success) {
        return parsed.data as SessionPocketStore
      } else {
        console.warn("Vault schema validation warning, repairing:", parsed.error)
        return {
          ...fallback,
          ...(rawStore as any),
          settings: { ...fallback.settings, ...(rawStore?.settings || {}) }
        }
      }
    } catch (err) {
      console.error("Failed to load vault:", err)
      return fallback
    }
  }

  /**
   * Save the SessionPocket store to chrome.storage.local
   */
  static async saveVault(store: SessionPocketStore): Promise<void> {
    if (!chrome?.storage?.local) return

    try {
      await chrome.storage.local.set({ [STORAGE_VAULT_KEY]: store })
    } catch (err) {
      console.error("Failed to save vault:", err)
    }
  }

  /**
   * Get active tab information and any currently active session pocket.
   */
  static async getActiveTabInfo(): Promise<ActiveTabInfo | null> {
    if (!chrome?.tabs) return null

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab || !activeTab.url) return null

      const parsed = parseUrl(activeTab.url)
      if (!parsed.isValid) {
        return {
          tabId: activeTab.id,
          url: activeTab.url,
          domain: "",
          apexDomain: "",
          origin: "",
          title: activeTab.title || "New Tab",
          faviconUrl: activeTab.favIconUrl,
          isIncognito: Boolean(activeTab.incognito)
        }
      }

      const vault = await this.loadVault()
      const activeSessionId =
        vault.activeSessions[parsed.domain] || vault.activeSessions[parsed.apexDomain]
      const activeSession = activeSessionId ? vault.sessions[activeSessionId] : undefined

      return {
        tabId: activeTab.id,
        url: parsed.url,
        domain: parsed.domain,
        apexDomain: parsed.apexDomain,
        origin: parsed.origin,
        title: activeTab.title || parsed.domain,
        faviconUrl: getFaviconUrl(parsed.domain, activeTab.favIconUrl),
        isIncognito: Boolean(activeTab.incognito),
        activeSession
      }
    } catch (err) {
      console.error("Error getting active tab info:", err)
      return null
    }
  }

  /**
   * Helper to format bytes into readable KB/MB string.
   */
  static formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 B"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  /**
   * Calculate storage size footprint of an existing saved pocket.
   */
  static calculatePocketSize(session: SessionPocket): {
    cookiesBytes: number
    storageBytes: number
    idbBytes: number
    totalBytes: number
    formattedTotal: string
  } {
    const cookiesBytes = session.cookies ? new Blob([JSON.stringify(session.cookies)]).size : 0
    const storageBytes = session.storage ? new Blob([JSON.stringify(session.storage)]).size : 0
    const idbBytes = session.idbSnapshot ? new Blob([JSON.stringify(session.idbSnapshot)]).size : 0
    const totalBytes = cookiesBytes + storageBytes + idbBytes

    return {
      cookiesBytes,
      storageBytes,
      idbBytes,
      totalBytes,
      formattedTotal: this.formatBytes(totalBytes)
    }
  }

  /**
   * Estimate live storage usage for the active tab (Cookies, LocalStorage, SessionStorage, IndexedDB).
   */
  static async estimateStorageSizes(
    tabId: number,
    url: string,
    domain: string,
    apexDomain: string,
    storeId: string = "0"
  ): Promise<StorageSizeEstimate> {
    let cookieCount = 0
    let cookieBytes = 0

    try {
      const cookies = await CookieEngine.captureCookies(url, domain, apexDomain, storeId)
      cookieCount = cookies.length
      cookieBytes = new Blob([JSON.stringify(cookies)]).size
    } catch (e) {}

    let lsCount = 0
    let lsBytes = 0
    let ssCount = 0
    let ssBytes = 0
    let idbDbCount = 0
    let idbBytes = 0

    if (chrome?.scripting) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: async () => {
            let localCount = 0
            let localBytes = 0
            let sessionCount = 0
            let sessionBytes = 0
            let dbsCount = 0
            let estimatedIdbBytes = 0

            try {
              localCount = window.localStorage.length
              const lsObj: Record<string, string> = {}
              for (let i = 0; i < localCount; i++) {
                const k = window.localStorage.key(i)
                if (k) lsObj[k] = window.localStorage.getItem(k) || ""
              }
              localBytes = new Blob([JSON.stringify(lsObj)]).size
            } catch (e) {}

            try {
              sessionCount = window.sessionStorage.length
              const ssObj: Record<string, string> = {}
              for (let i = 0; i < sessionCount; i++) {
                const k = window.sessionStorage.key(i)
                if (k) ssObj[k] = window.sessionStorage.getItem(k) || ""
              }
              sessionBytes = new Blob([JSON.stringify(ssObj)]).size
            } catch (e) {}

            try {
              if (window.indexedDB && typeof window.indexedDB.databases === "function") {
                const dbs = await window.indexedDB.databases()
                dbsCount = dbs ? dbs.length : 0

                // Accurately sample actual record counts across object stores
                for (const dbInfo of dbs) {
                  if (!dbInfo.name) continue
                  try {
                    const dbSize = await new Promise<number>((resDb) => {
                      const req = window.indexedDB.open(dbInfo.name!)
                      req.onerror = () => resDb(0)
                      req.onblocked = () => resDb(0)
                      req.onsuccess = () => {
                        const db = req.result
                        const storeNames = Array.from(db.objectStoreNames)
                        if (storeNames.length === 0) {
                          db.close()
                          resDb(0)
                          return
                        }
                        try {
                          const tx = db.transaction(storeNames, "readonly")
                          let totalStoreBytes = 0
                          let pending = storeNames.length
                          for (const sName of storeNames) {
                            const store = tx.objectStore(sName)
                            const countReq = store.count()
                            countReq.onsuccess = () => {
                              totalStoreBytes += (countReq.result || 0) * 250
                              pending--
                              if (pending === 0) {
                                db.close()
                                resDb(totalStoreBytes)
                              }
                            }
                            countReq.onerror = () => {
                              pending--
                              if (pending === 0) {
                                db.close()
                                resDb(totalStoreBytes)
                              }
                            }
                          }
                        } catch {
                          db.close()
                          resDb(0)
                        }
                      }
                    })
                    estimatedIdbBytes += dbSize
                  } catch {}
                }
              }
            } catch (e) {}

            return {
              localCount,
              localBytes,
              sessionCount,
              sessionBytes,
              dbsCount,
              estimatedIdbBytes
            }
          }
        })

        if (results && results[0] && results[0].result) {
          const res = results[0].result as any
          lsCount = res.localCount || 0
          lsBytes = res.localBytes || 0
          ssCount = res.sessionCount || 0
          ssBytes = res.sessionBytes || 0
          idbDbCount = res.dbsCount || 0
          idbBytes = res.estimatedIdbBytes || 0
        }
      } catch (e) {}
    }

    const totalBytes = cookieBytes + lsBytes + ssBytes + idbBytes

    return {
      cookies: { count: cookieCount, bytes: cookieBytes },
      localStorage: { count: lsCount, bytes: lsBytes },
      sessionStorage: { count: ssCount, bytes: ssBytes },
      indexedDB: { count: idbDbCount, bytes: idbBytes, dbCount: idbDbCount },
      totalBytes
    }
  }

  /**
   * Save current active tab session into a new pocket with customizable capture options.
   */
  static async saveCurrentSession(params: {
    name: string
    tag?: ColorTag
    notes?: string
    options?: Partial<CaptureOptions>
  }): Promise<SessionPocket> {
    const tabInfo = await this.getActiveTabInfo()
    if (!tabInfo || !tabInfo.tabId || !tabInfo.domain) {
      throw new Error("Cannot save session: No valid active web page detected.")
    }

    const storeId = tabInfo.isIncognito ? "1" : "0"
    const opts = {
      includeCookies: params.options?.includeCookies ?? true,
      includeLocalStorage: params.options?.includeLocalStorage ?? true,
      includeSessionStorage: params.options?.includeSessionStorage ?? true,
      includeIndexedDB: params.options?.includeIndexedDB ?? true
    }

    // 1. Capture cookies if selected
    const cookies = opts.includeCookies
      ? await CookieEngine.captureCookies(
          tabInfo.url,
          tabInfo.domain,
          tabInfo.apexDomain,
          storeId
        )
      : []

    // 2. Capture LocalStorage & SessionStorage if selected
    let storage = { localStorage: {}, sessionStorage: {} }
    if (opts.includeLocalStorage || opts.includeSessionStorage) {
      const fullStorage = await StorageEngine.captureStorage(tabInfo.tabId)
      storage = {
        localStorage: opts.includeLocalStorage ? fullStorage.localStorage : {},
        sessionStorage: opts.includeSessionStorage ? fullStorage.sessionStorage : {}
      }
    }

    // 3. Capture IndexedDB if selected
    const idbSnapshot = opts.includeIndexedDB
      ? await IDBEngine.captureIndexedDB(tabInfo.tabId)
      : undefined

    const now = Date.now()
    const session: SessionPocket = {
      id: `pocket_${now}_${Math.random().toString(36).slice(2, 9)}`,
      name: params.name.trim(),
      tag: params.tag || "indigo",
      url: tabInfo.url,
      domain: tabInfo.domain,
      apexDomain: tabInfo.apexDomain,
      origin: tabInfo.origin,
      faviconUrl: tabInfo.faviconUrl,
      createdAt: now,
      lastUsedAt: now,
      lastSavedAt: now,
      cookies,
      storage,
      idbSnapshot,
      notes: params.notes?.trim()
    }

    // Persist in vault
    const vault = await this.loadVault()
    vault.sessions[session.id] = session
    vault.activeSessions[session.domain] = session.id
    if (session.apexDomain) {
      vault.activeSessions[session.apexDomain] = session.id
    }
    await this.saveVault(vault)

    await this.updateBadge(session.name)

    return session
  }

  /**
   * Update an existing session with fresh cookies and storage from the active tab.
   */
  static async updateSession(sessionId: string): Promise<SessionPocket> {
    const vault = await this.loadVault()
    const existing = vault.sessions[sessionId]
    if (!existing) {
      throw new Error("Session pocket not found.")
    }

    const tabInfo = await this.getActiveTabInfo()
    if (!tabInfo || !tabInfo.tabId) {
      throw new Error("No active tab found to update session from.")
    }

    const storeId = tabInfo.isIncognito ? "1" : "0"

    const cookies = await CookieEngine.captureCookies(
      tabInfo.url,
      existing.domain,
      existing.apexDomain,
      storeId
    )
    const storage = await StorageEngine.captureStorage(tabInfo.tabId)
    const idbSnapshot = await IDBEngine.captureIndexedDB(tabInfo.tabId)

    const now = Date.now()
    existing.cookies = cookies
    existing.storage = storage
    if (idbSnapshot) existing.idbSnapshot = idbSnapshot
    existing.lastSavedAt = now
    existing.lastUsedAt = now

    vault.sessions[sessionId] = existing
    vault.activeSessions[existing.domain] = existing.id
    await this.saveVault(vault)

    return existing
  }

  /**
   * Check if extension is allowed in incognito mode.
   */
  static async checkIncognitoAllowed(): Promise<boolean> {
    if (!chrome?.extension?.isAllowedIncognitoAccess) return true
    return new Promise((resolve) => {
      chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
        resolve(isAllowed)
      })
    })
  }

  /**
   * Launch and apply a saved session pocket.
   */
  static async launchSession(
    sessionId: string,
    mode: "current-tab" | "new-tab" | "incognito" = "current-tab"
  ): Promise<void> {
    const vault = await this.loadVault()
    const targetSession = vault.sessions[sessionId]
    if (!targetSession) {
      throw new Error("Session not found.")
    }

    const currentTabInfo = await this.getActiveTabInfo()

    // Auto-sync current active session if enabled and different
    if (
      vault.settings.autoSyncOnSwitch &&
      currentTabInfo?.tabId &&
      currentTabInfo.activeSession &&
      currentTabInfo.activeSession.id !== sessionId &&
      currentTabInfo.domain === targetSession.domain
    ) {
      try {
        await this.updateSession(currentTabInfo.activeSession.id)
      } catch (err) {
        console.warn("Auto-sync prior to switch skipped:", err)
      }
    }

    if (mode === "incognito") {
      const allowed = await this.checkIncognitoAllowed()
      if (!allowed) {
        throw new Error(
          'Extension is not enabled in Incognito!\nPlease go to chrome://extensions -> SessionPocket -> Details -> Enable "Allow in incognito".'
        )
      }

      // 1. Open Incognito window with about:blank first
      if (chrome?.windows) {
        const win = await chrome.windows.create({
          incognito: true,
          url: "about:blank"
        })

        let targetTab = win?.tabs?.[0]
        if (!targetTab?.id && win?.id) {
          const tabs = await chrome.tabs.query({ windowId: win.id })
          targetTab = tabs[0]
        }

        if (!targetTab?.id) {
          throw new Error("Failed to create incognito window.")
        }

        const incognitoTabId = targetTab.id

        // 2. Discover exact incognito cookie store ID with fallback to "1"
        let incognitoStoreId = "1"
        try {
          if (chrome?.cookies?.getAllCookieStores) {
            const stores = await chrome.cookies.getAllCookieStores()
            const matched = stores.find((s) => s.tabIds && s.tabIds.includes(incognitoTabId))
            if (matched) incognitoStoreId = matched.id
          }
        } catch (e) {}

        await CookieEngine.clearDomainCookies(targetSession.domain, targetSession.apexDomain, incognitoStoreId)
        await CookieEngine.restoreCookies(targetSession.cookies, incognitoStoreId)

        const switchToken = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

        // 3. Queue storage restore in background service worker to survive popup closing
        try {
          chrome.runtime.sendMessage({
            type: "QUEUE_RESTORE",
            tabId: incognitoTabId,
            session: targetSession,
            switchToken
          })
        } catch (e) {}

        // 4. Navigate tab to target URL
        await chrome.tabs.update(incognitoTabId, { url: targetSession.url })
      }
    } else {
      // Regular window mode (0)
      // 1. Clear current domain cookies
      await CookieEngine.clearDomainCookies(targetSession.domain, targetSession.apexDomain, "0")
      // 2. Restore target cookies
      await CookieEngine.restoreCookies(targetSession.cookies, "0")

      let targetTabId: number | undefined

      if (mode === "new-tab" || !currentTabInfo?.tabId) {
        const newTab = await chrome.tabs.create({
          url: "about:blank",
          active: true
        })
        targetTabId = newTab.id
      } else {
        // Current tab
        targetTabId = currentTabInfo.tabId
      }

      if (targetTabId) {
        const switchToken = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

        // Queue in background service worker
        try {
          chrome.runtime.sendMessage({
            type: "QUEUE_RESTORE",
            tabId: targetTabId,
            session: targetSession,
            switchToken
          })
        } catch (e) {}

        await chrome.tabs.update(targetTabId, { url: targetSession.url })
      }
    }

    // Update active session in fresh vault to prevent overwriting auto-synced data
    const freshVault = await this.loadVault()
    freshVault.activeSessions[targetSession.domain] = targetSession.id
    if (targetSession.apexDomain) {
      freshVault.activeSessions[targetSession.apexDomain] = targetSession.id
    }
    if (freshVault.sessions[sessionId]) {
      freshVault.sessions[sessionId].lastUsedAt = Date.now()
    }
    await this.saveVault(freshVault)

    await this.updateBadge(targetSession.name)
  }

  /**
   * Injects web storage & IndexedDB as soon as tab completes initial navigation,
   * and executes a single reload so SPAs read the restored state on initial mount.
   */
  private static attachStorageRestorer(
    tabId: number,
    session: SessionPocket,
    switchToken?: string
  ): void {
    if (!chrome?.tabs?.onUpdated) return

    let injected = false
    const token = switchToken || `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const listener = async (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete" && !injected) {
        injected = true
        chrome.tabs.onUpdated.removeListener(listener)

        // Inject storage
        if (session.storage) {
          await StorageEngine.restoreStorage(tabId, session.storage)
        }
        if (session.idbSnapshot) {
          await IDBEngine.restoreIndexedDB(tabId, session.idbSnapshot)
        }

        // Single reload trigger with unique switch token to prevent lockout loop
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            args: [token],
            func: (t: string) => {
              if (sessionStorage.getItem("__sp_reload_token__") !== t) {
                sessionStorage.setItem("__sp_reload_token__", t)
                window.location.reload()
              }
            }
          })
        } catch (e) {}
      }
    }

    chrome.tabs.onUpdated.addListener(listener)

    // Fallback timeout to prevent listener leak
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
    }, 20000)
  }

  /**
   * Delete a session pocket.
   */
  static async deleteSession(sessionId: string): Promise<void> {
    const vault = await this.loadVault()
    const session = vault.sessions[sessionId]
    if (!session) return

    let badgeNeedsReset = false
    if (vault.activeSessions[session.domain] === sessionId) {
      delete vault.activeSessions[session.domain]
      badgeNeedsReset = true
    }
    if (session.apexDomain && vault.activeSessions[session.apexDomain] === sessionId) {
      delete vault.activeSessions[session.apexDomain]
      badgeNeedsReset = true
    }
    if (badgeNeedsReset) {
      await this.updateBadge("")
    }

    delete vault.sessions[sessionId]
    await this.saveVault(vault)
  }

  /**
   * Rename a session pocket or change its color tag.
   */
  static async renameSession(
    sessionId: string,
    newName: string,
    newTag?: ColorTag,
    notes?: string
  ): Promise<SessionPocket> {
    const vault = await this.loadVault()
    const session = vault.sessions[sessionId]
    if (!session) {
      throw new Error("Session not found.")
    }

    const trimmed = newName.trim()
    if (!trimmed) {
      throw new Error("Pocket name cannot be empty.")
    }

    session.name = trimmed
    if (newTag) session.tag = newTag
    if (notes !== undefined) session.notes = notes.trim()

    vault.sessions[sessionId] = session
    await this.saveVault(vault)

    if (vault.activeSessions[session.domain] === sessionId) {
      await this.updateBadge(session.name)
    }

    return session
  }

  /**
   * Update user settings.
   */
  static async updateSettings(settings: Partial<PocketSettings>): Promise<PocketSettings> {
    const vault = await this.loadVault()
    vault.settings = { ...vault.settings, ...settings }
    await this.saveVault(vault)
    return vault.settings
  }

  /**
   * Group sessions by website domain.
   */
  static getGroupedWebsites(vault: SessionPocketStore): WebsiteGroup[] {
    const groupMap = new Map<string, WebsiteGroup>()

    const allSessions = Object.values(vault.sessions).sort(
      (a, b) => b.lastUsedAt - a.lastUsedAt
    )

    for (const session of allSessions) {
      const key = session.apexDomain || session.domain
      let group = groupMap.get(key)

      if (!group) {
        group = {
          domain: session.domain,
          apexDomain: session.apexDomain,
          displayName: getWebsiteDisplayName(session.domain, session.apexDomain),
          faviconUrl: session.faviconUrl,
          sessions: [],
          activeSessionId: vault.activeSessions[session.domain] || vault.activeSessions[session.apexDomain]
        }
        groupMap.set(key, group)
      }

      group.sessions.push(session)
    }

    return Array.from(groupMap.values())
  }

  /**
   * Helper to trigger a browser file download of JSON text.
   */
  static downloadJsonFile(filename: string, jsonContent: string): void {
    const safeFilename = filename.endsWith(".json") ? filename : `${filename}.json`
    const blob = new Blob([jsonContent], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = safeFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Compress a string using browser's native gzip CompressionStream.
   */
  static async compressText(text: string): Promise<Uint8Array> {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))
    const response = new Response(stream)
    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
  }

  /**
   * Decompress a buffer using browser's native gzip DecompressionStream.
   */
  static async decompressBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))
    const response = new Response(stream)
    return await response.text()
  }

  /**
   * Download compressed binary archive (.spz).
   */
  static downloadCompressedFile(filename: string, data: Uint8Array): void {
    const safeFilename = filename.endsWith(".spz") || filename.endsWith(".gz") ? filename : `${filename}.spz`
    const blob = new Blob([data], { type: "application/gzip" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = safeFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Export all sessions as formatted JSON string or compressed binary.
   */
  static async exportVault(format: ExportFormat = "json"): Promise<{
    format: ExportFormat
    jsonString: string
    compressedData?: Uint8Array
    filename: string
  }> {
    const vault = await this.loadVault()
    const exportData = {
      format: "sessionpocket-backup" as const,
      version: 1,
      exportedAt: Date.now(),
      sessions: Object.values(vault.sessions),
      settings: vault.settings
    }
    const jsonString = JSON.stringify(exportData, null, 2)
    const dateStr = new Date().toISOString().slice(0, 10)

    if (format === "spz") {
      const compressedData = await this.compressText(jsonString)
      return {
        format: "spz",
        jsonString,
        compressedData,
        filename: `sessionpocket-vault-${dateStr}.spz`
      }
    }

    return {
      format: "json",
      jsonString,
      filename: `sessionpocket-vault-${dateStr}.json`
    }
  }

  /**
   * Export specific session pocket(s) with optional content filtering and compression.
   */
  static async exportSessions(
    sessionIds: string[],
    filterOptions?: Partial<ExportFilterOptions>
  ): Promise<{
    format: ExportFormat
    jsonString: string
    compressedData?: Uint8Array
    filename: string
  }> {
    const vault = await this.loadVault()
    const includeCookies = filterOptions?.includeCookies ?? true
    const includeStorage = filterOptions?.includeStorage ?? true
    const includeIndexedDB = filterOptions?.includeIndexedDB ?? true
    const format = filterOptions?.format ?? "json"

    const selected = sessionIds
      .map((id) => vault.sessions[id])
      .filter((s): s is SessionPocket => Boolean(s))
      .map((s) => {
        const copy: SessionPocket = JSON.parse(JSON.stringify(s))
        if (!includeCookies) copy.cookies = []
        if (!includeStorage) copy.storage = { localStorage: {}, sessionStorage: {} }
        if (!includeIndexedDB) copy.idbSnapshot = undefined
        return copy
      })

    const exportData = {
      format: "sessionpocket-backup" as const,
      version: 1,
      exportedAt: Date.now(),
      sessions: selected
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const baseName =
      selected.length === 1
        ? `pocket-${selected[0].domain}-${selected[0].name.toLowerCase().replace(/[^a-z0-9_-]/gi, "_")}`
        : `sessionpocket-export-${selected.length}-pockets`

    if (format === "spz") {
      const compressedData = await this.compressText(jsonString)
      return {
        format: "spz",
        jsonString,
        compressedData,
        filename: `${baseName}.spz`
      }
    }

    return {
      format: "json",
      jsonString,
      filename: `${baseName}.json`
    }
  }

  /**
   * Export single session pocket.
   */
  static async exportSingleSession(
    sessionId: string,
    filterOptions?: Partial<ExportFilterOptions>
  ): Promise<{
    format: ExportFormat
    jsonString: string
    compressedData?: Uint8Array
    filename: string
  }> {
    return this.exportSessions([sessionId], filterOptions)
  }

  /**
   * Export all pockets for a specific domain or apex domain.
   */
  static async exportWebsiteGroup(
    domain: string,
    filterOptions?: Partial<ExportFilterOptions>
  ): Promise<{
    format: ExportFormat
    jsonString: string
    compressedData?: Uint8Array
    filename: string
  }> {
    const vault = await this.loadVault()
    const targetApex = getApexDomain(domain)
    const matching = Object.values(vault.sessions).filter(
      (s) => s.domain === domain || s.apexDomain === targetApex || s.apexDomain === domain
    )
    return this.exportSessions(
      matching.map((s) => s.id),
      filterOptions
    )
  }

  /**
   * Validate and parse an imported file (accepts raw string JSON OR binary gzip ArrayBuffer/Uint8Array).
   * Supports standard backup object, raw array of pockets, or a single pocket object.
   */
  static async parseImportPayload(input: string | ArrayBuffer | Uint8Array): Promise<{
    success: boolean
    sessions?: SessionPocket[]
    error?: string
  }> {
    let jsonString: string

    if (typeof input !== "string") {
      const bytes = new Uint8Array(input)
      // Check for gzip magic numbers: 0x1f, 0x8b
      if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
        try {
          jsonString = await this.decompressBuffer(bytes)
        } catch (e: any) {
          return { success: false, error: "Failed to decompress .spz archive." }
        }
      } else {
        jsonString = new TextDecoder().decode(bytes)
      }
    } else {
      jsonString = input
    }

    let parsedJson: any
    try {
      parsedJson = JSON.parse(jsonString)
    } catch {
      return { success: false, error: "Invalid JSON syntax." }
    }

    const validated = FlexibleImportSchema.safeParse(parsedJson)
    if (!validated.success) {
      return {
        success: false,
        error: "File does not match valid SessionPocket schema."
      }
    }

    let rawList: SessionPocket[] = []
    if (Array.isArray(validated.data)) {
      rawList = validated.data as SessionPocket[]
    } else if ("sessions" in validated.data && Array.isArray(validated.data.sessions)) {
      rawList = validated.data.sessions as SessionPocket[]
    } else {
      // Single pocket object
      rawList = [validated.data as SessionPocket]
    }

    if (rawList.length === 0) {
      return { success: false, error: "No session pockets found in this file." }
    }

    return { success: true, sessions: rawList }
  }

  /**
   * Import pockets with customizable conflict resolution.
   */
  static async importPockets(
    pockets: SessionPocket[],
    options: { conflictStrategy: "overwrite" | "rename" | "skip" } = {
      conflictStrategy: "overwrite"
    }
  ): Promise<{ importedCount: number; updatedCount: number; skippedCount: number }> {
    const vault = await this.loadVault()
    let importedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const p of pockets) {
      const existingWithId = vault.sessions[p.id]
      const existingWithSameName = Object.values(vault.sessions).find(
        (s) =>
          s.domain === p.domain &&
          s.name.trim().toLowerCase() === p.name.trim().toLowerCase()
      )

      const hasConflict = Boolean(existingWithId || existingWithSameName)

      if (hasConflict) {
        if (options.conflictStrategy === "skip") {
          skippedCount++
          continue
        }

        if (options.conflictStrategy === "rename") {
          const newId = `pocket_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
          let newName = p.name
          if (existingWithSameName) {
            let copyIndex = 1
            let candidateName = `${p.name} (Copy)`
            while (
              Object.values(vault.sessions).some(
                (s) =>
                  s.domain === p.domain &&
                  s.name.trim().toLowerCase() === candidateName.toLowerCase()
              )
            ) {
              copyIndex++
              candidateName = `${p.name} (Copy ${copyIndex})`
            }
            newName = candidateName
          }

          vault.sessions[newId] = {
            ...p,
            id: newId,
            name: newName,
            lastSavedAt: Date.now()
          }
          importedCount++
          continue
        }

        // Overwrite strategy:
        const targetId = existingWithId ? p.id : existingWithSameName!.id
        vault.sessions[targetId] = {
          ...p,
          id: targetId,
          lastSavedAt: Date.now()
        }
        updatedCount++
        continue
      }

      // No conflict:
      vault.sessions[p.id] = {
        ...p,
        lastSavedAt: Date.now()
      }
      importedCount++
    }

    await this.saveVault(vault)
    return { importedCount, updatedCount, skippedCount }
  }

  /**
   * Import sessions from JSON or compressed .spz backup string/buffer.
   */
  static async importVault(
    input: string | ArrayBuffer | Uint8Array
  ): Promise<{ importedCount: number }> {
    const parsed = await this.parseImportPayload(input)
    if (!parsed.success || !parsed.sessions) {
      throw new Error(parsed.error || "Invalid backup file structure.")
    }

    const res = await this.importPockets(parsed.sessions, { conflictStrategy: "overwrite" })
    return { importedCount: res.importedCount + res.updatedCount }
  }

  /**
   * Delete multiple sessions at once.
   */
  static async deleteMultipleSessions(sessionIds: string[]): Promise<number> {
    const vault = await this.loadVault()
    let deletedCount = 0
    let badgeNeedsReset = false

    for (const id of sessionIds) {
      const session = vault.sessions[id]
      if (session) {
        if (vault.activeSessions[session.domain] === id) {
          delete vault.activeSessions[session.domain]
          badgeNeedsReset = true
        }
        if (session.apexDomain && vault.activeSessions[session.apexDomain] === id) {
          delete vault.activeSessions[session.apexDomain]
          badgeNeedsReset = true
        }
        delete vault.sessions[id]
        deletedCount++
      }
    }

    await this.saveVault(vault)
    if (badgeNeedsReset) {
      await this.updateBadge("")
    }
    return deletedCount
  }

  /**
   * Clear all sessions and reset vault.
   */
  static async clearAllData(): Promise<void> {
    const emptyVault: SessionPocketStore = {
      version: 1,
      sessions: {},
      activeSessions: {},
      settings: { ...DEFAULT_SETTINGS }
    }
    await this.saveVault(emptyVault)
    await this.updateBadge("")
  }

  /**
   * Update extension action badge text (per-tab when available to avoid cross-tab pollution).
   */
  static async updateBadge(text: string, tabId?: number): Promise<void> {
    if (!chrome?.action) return
    try {
      const badgeText = text ? text.slice(0, 4).toUpperCase() : ""
      if (tabId) {
        await chrome.action.setBadgeText({ text: badgeText, tabId })
        await chrome.action.setBadgeBackgroundColor({ color: "#6366f1", tabId })
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (activeTab?.id) {
          await chrome.action.setBadgeText({ text: badgeText, tabId: activeTab.id })
          await chrome.action.setBadgeBackgroundColor({ color: "#6366f1", tabId: activeTab.id })
        } else {
          await chrome.action.setBadgeText({ text: badgeText })
          await chrome.action.setBadgeBackgroundColor({ color: "#6366f1" })
        }
      }
    } catch {
      // Ignore badge errors
    }
  }
}

