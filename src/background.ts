import { STORAGE_VAULT_KEY } from "~lib/constants"
import { parseUrl } from "~lib/domain"
import { IDBEngine } from "~core/idb-engine"
import { StorageEngine } from "~core/storage-engine"
import type { SessionPocket } from "~types"

interface PendingRestore {
  session: SessionPocket
  switchToken: string
  timestamp: number
}

// In-memory cache of pending restores
const pendingRestores = new Map<number, PendingRestore>()

/**
 * Persist pending restore to chrome.storage.session for MV3 service worker dormancy survival.
 */
async function savePendingRestore(tabId: number, restore: PendingRestore) {
  pendingRestores.set(tabId, restore)
  try {
    if (chrome?.storage?.session) {
      await chrome.storage.session.set({ [`pending_restore_${tabId}`]: restore })
    }
  } catch (e) {}
}

async function getPendingRestore(tabId: number): Promise<PendingRestore | undefined> {
  if (pendingRestores.has(tabId)) {
    return pendingRestores.get(tabId)
  }
  try {
    if (chrome?.storage?.session) {
      const data = await chrome.storage.session.get(`pending_restore_${tabId}`)
      return data[`pending_restore_${tabId}`]
    }
  } catch (e) {}
  return undefined
}

async function clearPendingRestore(tabId: number) {
  pendingRestores.delete(tabId)
  try {
    if (chrome?.storage?.session) {
      await chrome.storage.session.remove(`pending_restore_${tabId}`)
    }
  } catch (e) {}
}

/**
 * Updates the extension badge text and color per tab.
 */
async function updateBadgeForTab(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab?.url) {
      await chrome.action.setBadgeText({ text: "", tabId })
      return
    }

    const parsed = parseUrl(tab.url)
    if (!parsed.isValid) {
      await chrome.action.setBadgeText({ text: "", tabId })
      return
    }

    const data = await chrome.storage.local.get(STORAGE_VAULT_KEY)
    const vault = data[STORAGE_VAULT_KEY]
    if (!vault || vault.settings?.showActiveBadge === false) {
      await chrome.action.setBadgeText({ text: "", tabId })
      return
    }

    const activeSessionId =
      vault.activeSessions?.[parsed.domain] || vault.activeSessions?.[parsed.apexDomain]
    if (activeSessionId && vault.sessions?.[activeSessionId]) {
      const session = vault.sessions[activeSessionId]
      const badgeText = session.name.slice(0, 4).toUpperCase()
      await chrome.action.setBadgeText({ text: badgeText, tabId })
      await chrome.action.setBadgeBackgroundColor({ color: "#6366f1", tabId })
    } else {
      await chrome.action.setBadgeText({ text: "", tabId })
    }
  } catch (err) {
    // Ignore badge update errors gracefully
  }
}

// Listen for queue restore messages from popup / session manager
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "QUEUE_RESTORE" && message.tabId && message.session) {
    const restore: PendingRestore = {
      session: message.session,
      switchToken: message.switchToken || `${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    }
    savePendingRestore(message.tabId, restore)
      .then(() => sendResponse({ queued: true }))
      .catch(() => sendResponse({ queued: false }))
    return true
  }
})

// When active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateBadgeForTab(activeInfo.tabId)
})

// When tab navigates or updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    await updateBadgeForTab(tabId)
  }

  // Handle pending storage & IndexedDB restoration on navigation complete
  if (changeInfo.status === "complete") {
    const restore = await getPendingRestore(tabId)
    if (restore) {
      await clearPendingRestore(tabId)

      // Fallback timeout check (skip if older than 60s)
      if (Date.now() - restore.timestamp < 60000) {
        try {
          if (restore.session.storage) {
            await StorageEngine.restoreStorage(tabId, restore.session.storage)
          }
          if (restore.session.idbSnapshot) {
            await IDBEngine.restoreIndexedDB(tabId, restore.session.idbSnapshot)
          }

          // Single reload trigger with unique switch token to prevent lockout loop
          await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            args: [restore.switchToken],
            func: (token: string) => {
              if (sessionStorage.getItem("__sp_reload_token__") !== token) {
                sessionStorage.setItem("__sp_reload_token__", token)
                window.location.reload()
              } else {
                sessionStorage.removeItem("__sp_reload_token__")
              }
            }
          })
        } catch (err) {
          console.warn("Background storage restore error:", err)
        }
      }
    }
  }
})

// Clean up pending restores when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearPendingRestore(tabId)
})

// Extension installation or upgrade listener
chrome.runtime.onInstalled.addListener(() => {
  // Service worker installed successfully
})

export {}
