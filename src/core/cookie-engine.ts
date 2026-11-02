import { isSafeApexDomain } from "~lib/domain"
import type { SameSiteStatus, SessionCookie } from "~types"

/**
 * Cookie Engine for capturing, cleaning, and restoring cookies with full fidelity,
 * including advanced CHIPS (Cookies Having Independent Partitioned State) support in Chrome MV3.
 */
export class CookieEngine {
  /**
   * Capture all cookies relevant to a given URL and its apex/subdomains.
   * Handles both unpartitioned and partitioned (CHIPS) cookies.
   */
  static async captureCookies(
    url: string,
    domain: string,
    apexDomain: string,
    storeId: string = "0"
  ): Promise<SessionCookie[]> {
    if (!chrome?.cookies) {
      console.warn("chrome.cookies API is unavailable")
      return []
    }

    const cookieMap = new Map<string, SessionCookie>()

    const addCookie = (c: chrome.cookies.Cookie) => {
      const pKey = (c as any).partitionKey?.topLevelSite || ""
      const key = `${c.name}@${c.domain}${c.path}#${pKey}`
      if (cookieMap.has(key)) return

      const sessionCookie: SessionCookie = {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: (c.sameSite as SameSiteStatus) || "unspecified",
        expirationDate: c.expirationDate,
        hostOnly: c.hostOnly,
        session: c.session,
        partitionKey: (c as any).partitionKey
      }
      cookieMap.set(key, sessionCookie)
    }

    const queryWithCHIPS = async (query: chrome.cookies.GetAllDetails) => {
      // 1. Standard unpartitioned cookies
      try {
        const standard = await chrome.cookies.getAll(query)
        standard.forEach(addCookie)
      } catch (e) {}

      // 2. Partitioned cookies (CHIPS in Chrome 119+ supports partitionKey: {})
      try {
        const partitioned = await chrome.cookies.getAll({ ...query, partitionKey: {} } as any)
        partitioned.forEach(addCookie)
      } catch (e) {
        // partitionKey: {} might throw in older Chrome engines; gracefully ignore
      }
    }

    try {
      // 1. Direct URL cookies
      await queryWithCHIPS({ url, storeId })

      // 2. Exact domain cookies
      await queryWithCHIPS({ domain, storeId })

      // 3. Dot-prefixed domain cookies
      if (!domain.startsWith(".")) {
        await queryWithCHIPS({ domain: `.${domain}`, storeId })
      }

      // 4. Apex domain cookies (if different from domain)
      if (apexDomain && apexDomain !== domain) {
        await queryWithCHIPS({ domain: apexDomain, storeId })
        await queryWithCHIPS({ domain: `.${apexDomain}`, storeId })
      }

      // 5. Special multi-domain session handlers (e.g. YouTube & Google auth)
      if (apexDomain === "youtube.com") {
        try {
          const googleCookies = await chrome.cookies.getAll({ domain: ".google.com", storeId })
          const relevantGoogleNames = new Set([
            "SID",
            "HSID",
            "SSID",
            "APISID",
            "SAPISID",
            "LOGIN_INFO",
            "__Secure-1PSID",
            "__Secure-3PSID",
            "__Secure-1PAPISID",
            "__Secure-3PAPISID",
            "__Secure-1PSIDTS",
            "__Secure-3PSIDTS",
            "OSID",
            "__Secure-OSID"
          ])
          googleCookies
            .filter((c) => relevantGoogleNames.has(c.name) || c.name.startsWith("__Secure-"))
            .forEach(addCookie)
        } catch (e) {}
      }
    } catch (err) {
      console.error("Error capturing cookies:", err)
    }

    return Array.from(cookieMap.values())
  }

  /**
   * Clear all cookies associated with a domain and its apex domain.
   * Cleans both unpartitioned and partitioned (CHIPS) cookies.
   */
  static async clearDomainCookies(
    domain: string,
    apexDomain: string,
    storeId: string = "0"
  ): Promise<number> {
    if (!chrome?.cookies) return 0

    let removedCount = 0
    const targetCookies = new Map<string, chrome.cookies.Cookie>()

    try {
      const domainsToSearch = new Set<string>()
      domainsToSearch.add(domain)
      domainsToSearch.add(`.${domain}`)
      if (apexDomain) {
        domainsToSearch.add(apexDomain)
        domainsToSearch.add(`.${apexDomain}`)
      }

      for (const d of domainsToSearch) {
        try {
          const cookies = await chrome.cookies.getAll({ domain: d, storeId })
          for (const c of cookies) {
            targetCookies.set(`${c.name}@${c.domain}${c.path}#${(c as any).partitionKey?.topLevelSite || ""}`, c)
          }
        } catch (e) {}

        try {
          const partitioned = await chrome.cookies.getAll({ domain: d, storeId, partitionKey: {} } as any)
          for (const c of partitioned) {
            targetCookies.set(`${c.name}@${c.domain}${c.path}#${(c as any).partitionKey?.topLevelSite || ""}`, c)
          }
        } catch (e) {}
      }

      // Also search all cookies matching the apex family to catch subdomains like auth.apexDomain, api.apexDomain
      // Protected by isSafeApexDomain so bare TLDs, localhost, or generic ccTLDs don't match third-party cookies
      if (isSafeApexDomain(apexDomain)) {
        try {
          const allFamilyCookies = await chrome.cookies.getAll({ storeId })
          for (const c of allFamilyCookies) {
            const cDom = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain
            if (cDom === apexDomain || cDom.endsWith(`.${apexDomain}`)) {
              targetCookies.set(`${c.name}@${c.domain}${c.path}#${(c as any).partitionKey?.topLevelSite || ""}`, c)
            }
          }
        } catch (e) {}
      }

      // If YouTube, also clear youtube-specific google cookies
      if (apexDomain === "youtube.com") {
        try {
          const ytCookies = await chrome.cookies.getAll({ domain: ".youtube.com", storeId })
          for (const c of ytCookies) {
            targetCookies.set(`${c.name}@${c.domain}${c.path}#${(c as any).partitionKey?.topLevelSite || ""}`, c)
          }
        } catch (e) {}
      }

      for (const cookie of targetCookies.values()) {
        const protocol = cookie.secure ? "https://" : "http://"
        const cleanHost = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
        const removalUrl = `${protocol}${cleanHost}${cookie.path || "/"}`

        const removeDetails: chrome.cookies.Details = {
          url: removalUrl,
          name: cookie.name,
          storeId: storeId
        }

        if ((cookie as any).partitionKey) {
          ;(removeDetails as any).partitionKey = (cookie as any).partitionKey
        }

        try {
          const removed = await chrome.cookies.remove(removeDetails)
          if (removed) {
            removedCount++
          } else if ((removeDetails as any).partitionKey) {
            delete (removeDetails as any).partitionKey
            const retryRemoved = await chrome.cookies.remove(removeDetails)
            if (retryRemoved) removedCount++
          }
        } catch (removeErr) {
          if ((removeDetails as any).partitionKey) {
            try {
              delete (removeDetails as any).partitionKey
              const retryRemoved = await chrome.cookies.remove(removeDetails)
              if (retryRemoved) removedCount++
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error("Error clearing domain cookies:", err)
    }

    return removedCount
  }

  /**
   * Restores a list of SessionCookies into the target cookie store.
   * Includes smart fallback for partitioned (CHIPS) cookies if partition context fails.
   */
  static async restoreCookies(
    cookies: SessionCookie[],
    targetStoreId: string = "0"
  ): Promise<{ success: number; failed: number }> {
    if (!chrome?.cookies) return { success: 0, failed: 0 }

    let success = 0
    let failed = 0

    for (const cookie of cookies) {
      try {
        let sameSite = (cookie.sameSite as SameSiteStatus) || "unspecified"
        let secure = Boolean(cookie.secure)

        const isHostPrefix = cookie.name.startsWith("__Host-")
        const isSecurePrefix = cookie.name.startsWith("__Secure-")

        // RFC 6265bis: __Secure- and __Host- cookies MUST be secure
        if (isHostPrefix || isSecurePrefix) {
          secure = true
        }

        // Chrome requirement: SameSite=None (no_restriction) requires Secure=true
        if (sameSite === "no_restriction") {
          secure = true
        }

        const protocol = secure ? "https://" : (cookie.secure ? "https://" : "http://")
        const cleanHost = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
        const cookieUrl = `${protocol}${cleanHost}${isHostPrefix ? "/" : (cookie.path || "/")}`

        const setDetails: chrome.cookies.SetDetails = {
          url: cookieUrl,
          name: cookie.name,
          value: cookie.value,
          path: isHostPrefix ? "/" : (cookie.path || "/"),
          secure: secure,
          httpOnly: Boolean(cookie.httpOnly),
          sameSite: sameSite,
          storeId: targetStoreId
        }

        // Host-only cookie check: Host-only, __Host-, and IP/localhost cookies must NOT have domain set
        const isIpOrLocalhost =
          cleanHost === "localhost" ||
          /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) ||
          cleanHost.includes(":")

        if (isHostPrefix || isIpOrLocalhost) {
          delete (setDetails as any).domain
        } else if (!cookie.hostOnly) {
          // Strip leading dot for chrome.cookies.set to avoid rejection in modern Chrome
          setDetails.domain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
        }

        // Expiration: keep valid or make persistent if session expired
        if (!cookie.session && cookie.expirationDate) {
          const nowSec = Math.floor(Date.now() / 1000)
          if (cookie.expirationDate > nowSec) {
            setDetails.expirationDate = cookie.expirationDate
          } else {
            // Set 180 days in future if it was expired
            setDetails.expirationDate = nowSec + 180 * 24 * 60 * 60
          }
        }

        // Handle CHIPS / Partitioned Cookies with URL validation
        if (cookie.partitionKey) {
          let topSite = cookie.partitionKey.topLevelSite
          if (topSite) {
            if (!topSite.startsWith("http://") && !topSite.startsWith("https://")) {
              topSite = `https://${topSite}`
            }
            ;(setDetails as any).partitionKey = { topLevelSite: topSite }
          }
        }

        try {
          let result = await chrome.cookies.set(setDetails)
          if (!result && (setDetails as any).partitionKey) {
            // Fallback: Retry setting without partitionKey if rejected
            delete (setDetails as any).partitionKey
            result = await chrome.cookies.set(setDetails)
          }

          if (result) {
            success++
          } else {
            failed++
          }
        } catch (setErr) {
          // Fallback if chrome.cookies.set threw an error due to partitionKey
          if ((setDetails as any).partitionKey) {
            try {
              delete (setDetails as any).partitionKey
              const fallback = await chrome.cookies.set(setDetails)
              if (fallback) {
                success++
              } else {
                failed++
              }
            } catch {
              failed++
            }
          } else {
            failed++
          }
        }
      } catch (err) {
        failed++
      }
    }

    return { success, failed }
  }
}


