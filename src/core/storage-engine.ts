import type { StorageData } from "~types"

/**
 * Storage Engine for capturing and injecting LocalStorage and SessionStorage via chrome.scripting.
 */
export class StorageEngine {
  /**
   * Capture localStorage and sessionStorage from an active tab.
   */
  static async captureStorage(tabId: number): Promise<StorageData> {
    if (!chrome?.scripting) {
      return { localStorage: {}, sessionStorage: {} }
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          const ls: Record<string, string> = {}
          const ss: Record<string, string> = {}

          try {
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i)
              if (key && key !== "__sp_reload_token__") {
                const val = window.localStorage.getItem(key)
                if (val !== null) ls[key] = val
              }
            }
          } catch (e) {
            // LocalStorage might be restricted by sandboxing or security policies
          }

          try {
            for (let i = 0; i < window.sessionStorage.length; i++) {
              const key = window.sessionStorage.key(i)
              if (key && key !== "__sp_reload_token__") {
                const val = window.sessionStorage.getItem(key)
                if (val !== null) ss[key] = val
              }
            }
          } catch (e) {
            // SessionStorage restricted
          }

          return { localStorage: ls, sessionStorage: ss }
        }
      })

      if (results && results[0] && results[0].result) {
        return results[0].result as StorageData
      }
    } catch (err) {
      console.warn("Storage capture error (tab might be restricted or navigating):", err)
    }

    return { localStorage: {}, sessionStorage: {} }
  }

  /**
   * Clear localStorage and sessionStorage in the target tab.
   */
  static async clearStorage(tabId: number): Promise<void> {
    if (!chrome?.scripting) return

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          try {
            window.localStorage.clear()
            window.sessionStorage.clear()
          } catch (e) {
            // Ignore
          }
        }
      })
    } catch (err) {
      console.warn("Error clearing web storage:", err)
    }
  }

  /**
   * Inject saved localStorage and sessionStorage into a tab.
   */
  static async restoreStorage(tabId: number, data: StorageData): Promise<void> {
    if (!chrome?.scripting) return

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        args: [data.localStorage || {}, data.sessionStorage || {}],
        func: (lsData: Record<string, string>, ssData: Record<string, string>) => {
          try {
            window.localStorage.clear()
          } catch (e) {
            console.warn("Error clearing localStorage:", e)
          }

          // Resilient item restoration: isolate individual keys so one failure doesn't halt the rest
          for (const [key, value] of Object.entries(lsData)) {
            try {
              window.localStorage.setItem(key, value)
            } catch (e) {
              console.warn(`Error setting localStorage key "${key}":`, e)
            }
          }

          try {
            window.sessionStorage.clear()
          } catch (e) {
            console.warn("Error clearing sessionStorage:", e)
          }

          for (const [key, value] of Object.entries(ssData)) {
            try {
              window.sessionStorage.setItem(key, value)
            } catch (e) {
              console.warn(`Error setting sessionStorage key "${key}":`, e)
            }
          }
        }
      })
    } catch (err) {
      console.warn("Error restoring web storage:", err)
    }
  }
}

