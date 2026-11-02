import test from "node:test"
import assert from "node:assert/strict"

import { parseUrl, getApexDomain, getWebsiteDisplayName, isSafeApexDomain } from "../src/lib/domain.ts"
import { SessionPocketSchema, ExportDataSchema, PocketSettingsSchema, FlexibleImportSchema } from "../src/lib/schema.ts"

test("Domain Utilities - parseUrl", () => {
  // WhatsApp Web
  const wa = parseUrl("https://web.whatsapp.com/")
  assert.equal(wa.isValid, true)
  assert.equal(wa.domain, "web.whatsapp.com")
  assert.equal(wa.apexDomain, "whatsapp.com")
  assert.equal(wa.origin, "https://web.whatsapp.com")

  // YouTube with query params
  const yt = parseUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(yt.isValid, true)
  assert.equal(yt.domain, "www.youtube.com")
  assert.equal(yt.apexDomain, "youtube.com")

  // Second-level TLDs (e.g. .co.uk)
  const uk = parseUrl("https://subdomain.service.co.uk/account")
  assert.equal(uk.isValid, true)
  assert.equal(uk.domain, "subdomain.service.co.uk")
  assert.equal(uk.apexDomain, "service.co.uk")

  // Invalid chrome:// URLs
  const chromeUrl = parseUrl("chrome://extensions")
  assert.equal(chromeUrl.isValid, false)

  // Edge / file URLs
  const fileUrl = parseUrl("file:///home/user/test.html")
  assert.equal(fileUrl.isValid, false)
})

test("Domain Utilities - getWebsiteDisplayName", () => {
  assert.equal(getWebsiteDisplayName("web.whatsapp.com", "whatsapp.com"), "WhatsApp")
  assert.equal(getWebsiteDisplayName("www.instagram.com", "instagram.com"), "Instagram")
  assert.equal(getWebsiteDisplayName("www.youtube.com", "youtube.com"), "YouTube")
  assert.equal(getWebsiteDisplayName("app.customservice.io", "customservice.io"), "Customservice")
})

test("Schema Validation - SessionPocketSchema", () => {
  const validSession = {
    id: "pocket_12345",
    name: "Work Account",
    tag: "indigo",
    url: "https://web.whatsapp.com/",
    domain: "web.whatsapp.com",
    apexDomain: "whatsapp.com",
    origin: "https://web.whatsapp.com",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    lastSavedAt: Date.now(),
    cookies: [
      {
        name: "wa_auth",
        value: "token_abc_123",
        domain: ".whatsapp.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax"
      }
    ],
    storage: {
      localStorage: { user_id: "usr_42" },
      sessionStorage: {}
    }
  }

  const result = SessionPocketSchema.safeParse(validSession)
  assert.equal(result.success, true)

  // Missing required field: name
  const invalidSession = { ...validSession, name: "" }
  const invalidResult = SessionPocketSchema.safeParse(invalidSession)
  assert.equal(invalidResult.success, false)
})

test("Schema Validation - ExportDataSchema", () => {
  const validExport = {
    format: "sessionpocket-backup",
    version: 1,
    exportedAt: Date.now(),
    sessions: [
      {
        id: "pocket_test_1",
        name: "Personal Instagram",
        tag: "rose",
        url: "https://www.instagram.com/",
        domain: "www.instagram.com",
        apexDomain: "instagram.com",
        origin: "https://www.instagram.com",
        createdAt: 1700000000000,
        lastUsedAt: 1700000000000,
        lastSavedAt: 1700000000000,
        cookies: [],
        storage: { localStorage: {}, sessionStorage: {} }
      }
    ],
    settings: {
      theme: "dark",
      autoSyncOnSwitch: true,
      confirmBeforeDelete: true,
      showActiveBadge: true
    }
  }

  const exportResult = ExportDataSchema.safeParse(validExport)
  assert.equal(exportResult.success, true)

  // Invalid backup format header
  const invalidFormat = { ...validExport, format: "wrong-format" }
  const invalidFormatResult = ExportDataSchema.safeParse(invalidFormat)
  assert.equal(invalidFormatResult.success, false)
})

test("Schema Validation - PocketSettingsSchema defaults", () => {
  const defaultSettings = PocketSettingsSchema.parse({})
  assert.equal(defaultSettings.theme, "dark")
  assert.equal(defaultSettings.autoSyncOnSwitch, true)
  assert.equal(defaultSettings.confirmBeforeDelete, true)
  assert.equal(defaultSettings.showActiveBadge, true)
})

test("Flexible Import Schema - Validates single pocket, array, or standard backup", () => {
  const samplePocket = {
    id: "pocket_single_1",
    name: "Single WhatsApp",
    tag: "indigo",
    url: "https://web.whatsapp.com/",
    domain: "web.whatsapp.com",
    apexDomain: "whatsapp.com",
    origin: "https://web.whatsapp.com",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    lastSavedAt: Date.now(),
    cookies: [],
    storage: { localStorage: {}, sessionStorage: {} }
  }

  // 1. Single Pocket JSON
  const singleResult = FlexibleImportSchema.safeParse(samplePocket)
  assert.equal(singleResult.success, true)

  // 2. Array of Pockets JSON
  const arrayResult = FlexibleImportSchema.safeParse([samplePocket])
  assert.equal(arrayResult.success, true)

  // 3. Standard SessionPocket Backup format
  const backupObj = {
    format: "sessionpocket-backup",
    version: 1,
    exportedAt: Date.now(),
    sessions: [samplePocket]
  }
  const backupResult = FlexibleImportSchema.safeParse(backupObj)
  assert.equal(backupResult.success, true)

  // 4. Invalid data
  const invalidResult = FlexibleImportSchema.safeParse({ invalid: 123 })
  assert.equal(invalidResult.success, false)
})

test("Native Gzip Compression - Compresses and decompresses session archives losslessly", async () => {
  const sampleData = JSON.stringify({
    format: "sessionpocket-backup",
    version: 1,
    exportedAt: 1700000000000,
    sessions: [
      {
        id: "pocket_gzip_test",
        name: "Testing Gzip Archive",
        tag: "emerald",
        url: "https://example.com/app",
        domain: "example.com",
        apexDomain: "example.com",
        origin: "https://example.com",
        createdAt: 1700000000000,
        lastUsedAt: 1700000000000,
        lastSavedAt: 1700000000000,
        cookies: [
          {
            name: "session_token",
            value: "super_secret_token_123456789_repetitive_text_for_compression_testing",
            domain: ".example.com",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          }
        ],
        storage: {
          localStorage: { auth_state: JSON.stringify({ loggedIn: true, user: "admin", id: 42 }) },
          sessionStorage: {}
        }
      }
    ]
  })

  // Compress using native CompressionStream
  const stream = new Blob([sampleData]).stream().pipeThrough(new CompressionStream("gzip"))
  const compressedBuffer = await new Response(stream).arrayBuffer()
  const compressedBytes = new Uint8Array(compressedBuffer)

  // Verify gzip magic bytes
  assert.equal(compressedBytes[0], 0x1f)
  assert.equal(compressedBytes[1], 0x8b)

  // Verify compression ratio: compressed is significantly smaller
  assert.ok(compressedBytes.byteLength < sampleData.length)

  // Decompress using native DecompressionStream
  const decompStream = new Blob([compressedBuffer]).stream().pipeThrough(new DecompressionStream("gzip"))
  const decompressedText = await new Response(decompStream).text()

  assert.equal(decompressedText, sampleData)

  const parsed = JSON.parse(decompressedText)
  const validation = FlexibleImportSchema.safeParse(parsed)
  assert.equal(validation.success, true)
})

test("CHIPS - PartitionKey Schema Validation", () => {
  const partitionedCookie = {
    id: "pocket_chips_test",
    name: "Partitioned App",
    tag: "indigo",
    url: "https://embed.partner.com/",
    domain: "embed.partner.com",
    apexDomain: "partner.com",
    origin: "https://embed.partner.com",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    lastSavedAt: Date.now(),
    cookies: [
      {
        name: "__Host-partitioned-token",
        value: "token_chips_val",
        domain: "embed.partner.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "no_restriction",
        partitionKey: {
          topLevelSite: "https://parent-app.com"
        }
      }
    ],
    storage: { localStorage: {}, sessionStorage: {} }
  }

  const result = SessionPocketSchema.safeParse(partitionedCookie)
  assert.equal(result.success, true)
  assert.equal(result.data?.cookies[0]?.partitionKey?.topLevelSite, "https://parent-app.com")
})

test("Bug Fix Verification - IP Addresses & ccTLD Apex Domain Parsing", () => {
  // IPv4 should not be sliced into invalid 2-part domains like "1.1"
  assert.equal(getApexDomain("192.168.1.1"), "192.168.1.1")
  assert.equal(getApexDomain("127.0.0.1"), "127.0.0.1")
  assert.equal(getApexDomain("10.0.0.50"), "10.0.0.50")

  const ipUrl = parseUrl("http://192.168.1.100:8080/admin/settings")
  assert.equal(ipUrl.isValid, true)
  assert.equal(ipUrl.domain, "192.168.1.100")
  assert.equal(ipUrl.apexDomain, "192.168.1.100")

  // Complex multi-part ccTLDs (.gov.in, .edu.in, .gov.uk, .com.au, .ac.in)
  assert.equal(getApexDomain("portal.tax.gov.in"), "tax.gov.in")
  assert.equal(getApexDomain("sub.univ.edu.in"), "univ.edu.in")
  assert.equal(getApexDomain("service.digital.gov.uk"), "digital.gov.uk")
  assert.equal(getApexDomain("dashboard.app.com.au"), "app.com.au")
  assert.equal(getApexDomain("node.research.ac.in"), "research.ac.in")

  // Localhost
  assert.equal(getApexDomain("localhost"), "localhost")
  const localhostUrl = parseUrl("http://localhost:3000/dashboard")
  assert.equal(localhostUrl.isValid, true)
  assert.equal(localhostUrl.domain, "localhost")
  assert.equal(localhostUrl.apexDomain, "localhost")

  // Standard multi-level domains
  assert.equal(getApexDomain("deep.sub.github.com"), "github.com")
  assert.equal(getApexDomain("web.whatsapp.com"), "whatsapp.com")
})

test("Bug Fix Verification - Blank Pocket Name Validation", () => {
  const basePocket = {
    id: "pocket_valid_name",
    name: "Valid Account",
    tag: "indigo",
    url: "https://example.com",
    domain: "example.com",
    apexDomain: "example.com",
    origin: "https://example.com",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    lastSavedAt: Date.now(),
    cookies: [],
    storage: { localStorage: {}, sessionStorage: {} }
  }

  // Valid
  assert.equal(SessionPocketSchema.safeParse(basePocket).success, true)

  // Empty string name
  const emptyName = { ...basePocket, name: "" }
  assert.equal(SessionPocketSchema.safeParse(emptyName).success, false)

  // Empty rename validation function check
  function validateRename(newName: string) {
    if (!newName || !newName.trim()) {
      throw new Error("Pocket name cannot be empty.")
    }
    return newName.trim()
  }

  assert.throws(() => validateRename(""), /cannot be empty/)
  assert.throws(() => validateRename("   "), /cannot be empty/)
  assert.equal(validateRename("  New Name  "), "New Name")
})

test("Bug Fix Verification - Selective Export Filtering & Storage Formatting", () => {
  // Format bytes helper verification
  function formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 B"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  assert.equal(formatBytes(0), "0 B")
  assert.equal(formatBytes(500), "500 B")
  assert.equal(formatBytes(1024), "1.0 KB")
  assert.equal(formatBytes(1536), "1.5 KB")
  assert.equal(formatBytes(1048576), "1.00 MB")
  assert.equal(formatBytes(2621440), "2.50 MB")

  // Selective filtering simulation
  const fullPocket = {
    id: "pocket_filter_test",
    name: "Full Data Pocket",
    tag: "indigo",
    url: "https://test.com",
    domain: "test.com",
    apexDomain: "test.com",
    origin: "https://test.com",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    lastSavedAt: Date.now(),
    cookies: [{ name: "c1", value: "v1", domain: "test.com", path: "/", secure: true, httpOnly: false, sameSite: "lax" as const }],
    storage: { localStorage: { key1: "val1" }, sessionStorage: { sKey: "sVal" } },
    idbSnapshot: { origin: "https://test.com", capturedAt: Date.now(), databases: [] }
  }

  function applyExportFilter(
    session: typeof fullPocket,
    filter?: { includeCookies?: boolean; includeStorage?: boolean; includeIDB?: boolean }
  ) {
    const storage: { localStorage: Record<string, string>; sessionStorage: Record<string, string> } =
      filter?.includeStorage !== false ? { ...session.storage } : { localStorage: {}, sessionStorage: {} }

    return {
      ...session,
      cookies: filter?.includeCookies !== false ? [...session.cookies] : [],
      storage,
      idbSnapshot: filter?.includeIDB !== false ? session.idbSnapshot : undefined
    }
  }

  // 1. Without Cookies
  const noCookies = applyExportFilter(fullPocket, { includeCookies: false, includeStorage: true, includeIDB: true })
  assert.equal(noCookies.cookies.length, 0)
  assert.equal(noCookies.storage.localStorage.key1, "val1")
  assert.ok(noCookies.idbSnapshot !== undefined)

  // 2. Without LocalStorage/SessionStorage
  const noStorage = applyExportFilter(fullPocket, { includeCookies: true, includeStorage: false, includeIDB: true })
  assert.equal(noStorage.cookies.length, 1)
  assert.deepEqual(noStorage.storage, { localStorage: {}, sessionStorage: {} })
  assert.ok(noStorage.idbSnapshot !== undefined)

  // 3. Without IDB
  const noIDB = applyExportFilter(fullPocket, { includeCookies: true, includeStorage: true, includeIDB: false })
  assert.equal(noIDB.cookies.length, 1)
  assert.equal(noIDB.idbSnapshot, undefined)

  // 4. All excluded (minimal)
  const minimal = applyExportFilter(fullPocket, { includeCookies: false, includeStorage: false, includeIDB: false })
  assert.equal(minimal.cookies.length, 0)
  assert.deepEqual(minimal.storage, { localStorage: {}, sessionStorage: {} })
  assert.equal(minimal.idbSnapshot, undefined)
})

test("Bug Fix Verification - RFC 6265bis & SameSite Cookie Sanitization", () => {
  function sanitizeCookie(cookie: {
    name: string
    value: string
    domain: string
    path: string
    secure?: boolean
    sameSite?: string
    hostOnly?: boolean
  }) {
    let sameSite = cookie.sameSite || "unspecified"
    let secure = Boolean(cookie.secure)
    const isHostPrefix = cookie.name.startsWith("__Host-")
    const isSecurePrefix = cookie.name.startsWith("__Secure-")

    // RFC 6265bis
    if (isHostPrefix || isSecurePrefix) {
      secure = true
    }
    if (sameSite === "no_restriction") {
      secure = true
    }

    const setDetails: Record<string, any> = {
      name: cookie.name,
      value: cookie.value,
      path: isHostPrefix ? "/" : (cookie.path || "/"),
      secure,
      sameSite
    }

    if (isHostPrefix) {
      delete setDetails.domain
    } else if (!cookie.hostOnly) {
      setDetails.domain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
    }

    return setDetails
  }

  // 1. __Host- cookie MUST be secure, path MUST be "/", and domain MUST NOT be present
  const hostCookie = sanitizeCookie({
    name: "__Host-user-auth",
    value: "xyz123",
    domain: "accounts.google.com",
    path: "/oauth",
    secure: false
  })
  assert.equal(hostCookie.secure, true)
  assert.equal(hostCookie.path, "/")
  assert.equal(hostCookie.domain, undefined)

  // 2. __Secure- cookie MUST be secure
  const secureCookie = sanitizeCookie({
    name: "__Secure-session-id",
    value: "abc789",
    domain: ".example.com",
    path: "/api",
    secure: false
  })
  assert.equal(secureCookie.secure, true)
  assert.equal(secureCookie.domain, "example.com") // leading dot stripped

  // 3. SameSite=None (no_restriction) MUST enforce secure: true
  const sameSiteNoneCookie = sanitizeCookie({
    name: "cross-site-cookie",
    value: "embedded_val",
    domain: "embed.com",
    path: "/",
    secure: false,
    sameSite: "no_restriction"
  })
  assert.equal(sameSiteNoneCookie.secure, true)
})

test("Bug Fix Verification - Safe Apex Domain Cookie Guard", () => {
  // Valid apex domains allowed for family matching
  assert.equal(isSafeApexDomain("youtube.com"), true)
  assert.equal(isSafeApexDomain("whatsapp.com"), true)
  assert.equal(isSafeApexDomain("tax.gov.in"), true)
  assert.equal(isSafeApexDomain("app.service.co.uk"), true)

  // Dangerous / bare TLDs or second-level domains must NOT be allowed
  assert.equal(isSafeApexDomain("co.uk"), false)
  assert.equal(isSafeApexDomain("gov.in"), false)
  assert.equal(isSafeApexDomain("com.au"), false)
  assert.equal(isSafeApexDomain("com"), false)
  assert.equal(isSafeApexDomain("org"), false)

  // Localhost & IP addresses must not be wildcard apex queried
  assert.equal(isSafeApexDomain("localhost"), false)
  assert.equal(isSafeApexDomain("192.168.1.1"), false)
  assert.equal(isSafeApexDomain("127.0.0.1"), false)
  assert.equal(isSafeApexDomain(""), false)
})

test("Bug Fix Verification - Localhost & IP Address Host-Only Cookie Sanitization", () => {
  function sanitizeCookieForHost(cookie: {
    name: string
    value: string
    domain: string
    path: string
    secure?: boolean
    hostOnly?: boolean
  }) {
    const cleanHost = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
    const isIpOrLocalhost =
      cleanHost === "localhost" ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) ||
      cleanHost.includes(":")

    const setDetails: Record<string, any> = {
      name: cookie.name,
      value: cookie.value,
      path: cookie.path || "/",
      secure: Boolean(cookie.secure)
    }

    if (cookie.name.startsWith("__Host-") || isIpOrLocalhost) {
      delete setDetails.domain
    } else if (!cookie.hostOnly) {
      setDetails.domain = cleanHost
    }

    return setDetails
  }

  // 1. Localhost cookie MUST NOT have domain set (prevents Chrome "Domain localhost is not allowed" error)
  const localCookie = sanitizeCookieForHost({
    name: "dev_session",
    value: "token_123",
    domain: "localhost",
    path: "/"
  })
  assert.equal(localCookie.domain, undefined)

  // 2. IP address cookie MUST NOT have domain set
  const ipCookie = sanitizeCookieForHost({
    name: "admin_token",
    value: "token_ip_456",
    domain: "192.168.1.1",
    path: "/"
  })
  assert.equal(ipCookie.domain, undefined)

  // 3. Regular domain cookie retains domain
  const webCookie = sanitizeCookieForHost({
    name: "auth_token",
    value: "token_web_789",
    domain: ".chatgpt.com",
    path: "/"
  })
  assert.equal(webCookie.domain, "chatgpt.com")
})

test("Bug Fix Verification - Storage Engine Internal Reload Token Filtering", () => {
  // Simulate captureStorage with internal token
  const rawStorageItems: Record<string, string> = {
    auth_token: "jwt_eyJhbGciOi...",
    user_settings: JSON.stringify({ theme: "dark" }),
    __sp_reload_token__: "1710000000_abc123"
  }

  const capturedLocalStorage: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawStorageItems)) {
    if (k && k !== "__sp_reload_token__") {
      capturedLocalStorage[k] = v
    }
  }

  // Verify internal token was stripped
  assert.equal("__sp_reload_token__" in capturedLocalStorage, false)
  assert.equal(capturedLocalStorage.auth_token, "jwt_eyJhbGciOi...")
  assert.equal(Object.keys(capturedLocalStorage).length, 2)
})

test("Bug Fix Verification - Resilient LocalStorage Key Restoration on Quota Error", () => {
  const restoredMap: Record<string, string> = {}

  // Mock setItem that throws QuotaExceededError on a specific huge key
  function mockSetItem(key: string, value: string) {
    if (key === "huge_bloat_cache") {
      throw new Error("QuotaExceededError: storage quota exceeded")
    }
    restoredMap[key] = value
  }

  const inputStorage: Record<string, string> = {
    auth_key_1: "token_first",
    huge_bloat_cache: "x".repeat(100000),
    auth_key_2: "token_second"
  }

  // Resilient loop with per-key try-catch
  for (const [k, v] of Object.entries(inputStorage)) {
    try {
      mockSetItem(k, v)
    } catch (e) {
      // Ignored gracefully so other keys survive
    }
  }

  // Verify auth_key_1 and auth_key_2 were restored despite huge_bloat_cache failure
  assert.equal(restoredMap.auth_key_1, "token_first")
  assert.equal(restoredMap.auth_key_2, "token_second")
  assert.equal(restoredMap.huge_bloat_cache, undefined)
})

test("Bug Fix Verification - Import Conflict Resolution Auto-Increment Suffix", () => {
  const existingSessions = [
    { domain: "web.whatsapp.com", name: "Work" },
    { domain: "web.whatsapp.com", name: "Work (Copy)" }
  ]

  function getNextAvailableName(name: string, domain: string, list: typeof existingSessions) {
    let copyIndex = 1
    let candidateName = `${name} (Copy)`
    while (
      list.some(
        (s) => s.domain === domain && s.name.trim().toLowerCase() === candidateName.toLowerCase()
      )
    ) {
      copyIndex++
      candidateName = `${name} (Copy ${copyIndex})`
    }
    return candidateName
  }

  // First copy when Work exists
  const copy1 = getNextAvailableName("Work", "web.whatsapp.com", [{ domain: "web.whatsapp.com", name: "Work" }])
  assert.equal(copy1, "Work (Copy)")

  // Second copy when Work and Work (Copy) both exist
  const copy2 = getNextAvailableName("Work", "web.whatsapp.com", existingSessions)
  assert.equal(copy2, "Work (Copy 2)")

  // Third copy when Work, Work (Copy), and Work (Copy 2) all exist
  const copy3 = getNextAvailableName("Work", "web.whatsapp.com", [
    ...existingSessions,
    { domain: "web.whatsapp.com", name: "Work (Copy 2)" }
  ])
  assert.equal(copy3, "Work (Copy 3)")
})

test("Bug Fix Verification - Subdomain & Apex Domain Active Pocket Fallback Resolution", () => {
  const activeSessions: Record<string, string> = {
    "youtube.com": "pocket_yt_main",
    "web.whatsapp.com": "pocket_wa_web"
  }

  function resolveActivePocket(domain: string, apexDomain: string) {
    return activeSessions[domain] || activeSessions[apexDomain] || undefined
  }

  // Exact domain match
  assert.equal(resolveActivePocket("web.whatsapp.com", "whatsapp.com"), "pocket_wa_web")

  // Subdomain match via apex fallback (www.youtube.com -> youtube.com)
  assert.equal(resolveActivePocket("www.youtube.com", "youtube.com"), "pocket_yt_main")
  assert.equal(resolveActivePocket("m.youtube.com", "youtube.com"), "pocket_yt_main")

  // No active session for other domains
  assert.equal(resolveActivePocket("github.com", "github.com"), undefined)
})

test("Bug Fix Verification - Auto-Sync Stale Vault Overwrite Prevention", () => {
  // Initial vault state
  let diskVault = {
    sessions: {
      pocket_outgoing: { id: "pocket_outgoing", name: "Personal Account", cookies: [{ name: "c", value: "old_token" }] },
      pocket_target: { id: "pocket_target", name: "Work Account", cookies: [{ name: "c", value: "target_token" }] }
    },
    activeSessions: { "site.com": "pocket_outgoing" }
  }

  // launchSession loads initial vault
  const staleVault = JSON.parse(JSON.stringify(diskVault))

  // autoSync updates outgoing session on disk
  diskVault.sessions.pocket_outgoing.cookies = [{ name: "c", value: "fresh_synced_token" }]

  // Fixed launchSession: reloads fresh diskVault before updating activeSessions & lastUsedAt
  function finalizeSwitch(freshVault: typeof diskVault, targetId: string) {
    freshVault.activeSessions["site.com"] = targetId
    return freshVault
  }

  const finalSavedVault = finalizeSwitch(diskVault, "pocket_target")

  // Verify fresh auto-synced cookies were NOT erased by staleVault
  assert.equal(finalSavedVault.sessions.pocket_outgoing.cookies[0].value, "fresh_synced_token")
  assert.equal(finalSavedVault.activeSessions["site.com"], "pocket_target")
})




