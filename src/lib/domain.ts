/**
 * Domain and URL utility functions
 */

const GENERIC_SECOND_LEVEL_PREFIXES = new Set([
  "com",
  "co",
  "org",
  "gov",
  "edu",
  "net",
  "ac",
  "res",
  "nic",
  "mil",
  "gen"
])

const KNOWN_SECOND_LEVEL_DOMAINS = new Set([
  "co.uk",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.za",
  "co.in",
  "co.id",
  "com.au",
  "com.br",
  "com.cn",
  "com.mx",
  "com.sg",
  "com.tr",
  "com.pk",
  "com.ng",
  "com.tw",
  "com.hk",
  "org.uk",
  "gov.uk",
  "gov.in",
  "edu.in",
  "ac.uk",
  "ac.in"
])

const WELL_KNOWN_NAMES: Record<string, string> = {
  "whatsapp.com": "WhatsApp",
  "instagram.com": "Instagram",
  "youtube.com": "YouTube",
  "google.com": "Google",
  "twitter.com": "Twitter / X",
  "x.com": "X (Twitter)",
  "github.com": "GitHub",
  "reddit.com": "Reddit",
  "linkedin.com": "LinkedIn",
  "facebook.com": "Facebook",
  "discord.com": "Discord",
  "slack.com": "Slack",
  "notion.so": "Notion",
  "tiktok.com": "TikTok",
  "twitch.tv": "Twitch",
  "netflix.com": "Netflix",
  "spotify.com": "Spotify",
  "amazon.com": "Amazon"
}

export function parseUrl(rawUrl: string): {
  url: string
  origin: string
  domain: string
  apexDomain: string
  protocol: string
  isValid: boolean
} {
  try {
    const parsed = new URL(rawUrl)
    const protocol = parsed.protocol

    if (protocol !== "http:" && protocol !== "https:") {
      return {
        url: rawUrl,
        origin: "",
        domain: "",
        apexDomain: "",
        protocol,
        isValid: false
      }
    }

    const domain = parsed.hostname.toLowerCase()
    const origin = parsed.origin
    const apexDomain = getApexDomain(domain)

    return {
      url: parsed.href,
      origin,
      domain,
      apexDomain,
      protocol,
      isValid: true
    }
  } catch {
    return {
      url: rawUrl,
      origin: "",
      domain: "",
      apexDomain: "",
      protocol: "",
      isValid: false
    }
  }
}

export function getApexDomain(hostname: string): string {
  if (!hostname) return ""

  // IP addresses (IPv4 & IPv6) and localhost should not be sliced
  if (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
    hostname === "localhost" ||
    hostname.includes(":")
  ) {
    return hostname
  }

  const parts = hostname.split(".").filter(Boolean)
  if (parts.length <= 2) return hostname

  const lastTwo = parts.slice(-2).join(".")
  const secondToLast = parts[parts.length - 2]
  const last = parts[parts.length - 1]

  // Check known second-level domains OR generic ccTLD patterns (e.g. .gov.in, .edu.xx)
  const isSecondLevel =
    KNOWN_SECOND_LEVEL_DOMAINS.has(lastTwo) ||
    (last.length === 2 && GENERIC_SECOND_LEVEL_PREFIXES.has(secondToLast))

  if (isSecondLevel && parts.length >= 3) {
    return parts.slice(-3).join(".")
  }

  return parts.slice(-2).join(".")
}

export function isSafeApexDomain(apexDomain: string): boolean {
  if (!apexDomain || typeof apexDomain !== "string") return false
  const clean = apexDomain.trim().toLowerCase()
  if (clean.length < 3 || !clean.includes(".")) return false

  // Disallow bare TLDs or known second-level domains (e.g. "co.uk", "gov.in")
  if (KNOWN_SECOND_LEVEL_DOMAINS.has(clean) || GENERIC_SECOND_LEVEL_PREFIXES.has(clean)) {
    return false
  }

  // IP addresses or localhost should not be used as apex wildcards
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean) || clean === "localhost" || clean.includes(":")) {
    return false
  }

  return true
}

export function getWebsiteDisplayName(domain: string, apexDomain: string): string {
  if (WELL_KNOWN_NAMES[apexDomain]) {
    return WELL_KNOWN_NAMES[apexDomain]
  }

  // Capitalize main part of apex domain (e.g. example.com -> Example)
  const namePart = apexDomain.split(".")[0]
  if (namePart) {
    return namePart.charAt(0).toUpperCase() + namePart.slice(1)
  }

  return domain
}

export function getFaviconUrl(domain: string, pageFavicon?: string): string {
  if (pageFavicon && !pageFavicon.startsWith("chrome://")) {
    return pageFavicon
  }
  // High quality Google S2 favicon service fallback
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
}

