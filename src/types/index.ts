export type SameSiteStatus = "unspecified" | "no_restriction" | "lax" | "strict"

export interface SessionCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: SameSiteStatus
  expirationDate?: number
  hostOnly?: boolean
  session?: boolean
  partitionKey?: {
    topLevelSite?: string
  }
}

export interface StorageData {
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
}

export interface IDBRecord {
  key?: any
  value: any
}

export interface IDBIndexData {
  name: string
  keyPath: any
  unique: boolean
  multiEntry: boolean
}

export interface IDBStoreData {
  name: string
  keyPath?: any
  autoIncrement: boolean
  indexes?: IDBIndexData[]
  records: IDBRecord[]
}

export interface IDBDatabaseData {
  name: string
  version: number
  stores: IDBStoreData[]
}

export interface IDBSnapshot {
  databases: IDBDatabaseData[]
  capturedAt: number
}

export type ColorTag = "indigo" | "emerald" | "amber" | "rose" | "cyan" | "purple" | "slate"

export interface SessionPocket {
  id: string
  name: string
  tag: ColorTag
  url: string
  domain: string
  apexDomain: string
  origin: string
  faviconUrl?: string
  createdAt: number
  lastUsedAt: number
  lastSavedAt: number
  cookies: SessionCookie[]
  storage: StorageData
  idbSnapshot?: IDBSnapshot
  notes?: string
}

export interface WebsiteGroup {
  domain: string
  apexDomain: string
  displayName: string
  faviconUrl?: string
  sessions: SessionPocket[]
  activeSessionId?: string
}

export interface PocketSettings {
  theme: "dark" | "light" | "system"
  autoSyncOnSwitch: boolean
  confirmBeforeDelete: boolean
  showActiveBadge: boolean
}

export interface SessionPocketStore {
  version: number
  sessions: Record<string, SessionPocket>
  activeSessions: Record<string, string> // domain -> sessionId
  settings: PocketSettings
}

export interface ActiveTabInfo {
  tabId?: number
  url: string
  domain: string
  apexDomain: string
  origin: string
  title: string
  faviconUrl?: string
  isIncognito: boolean
  activeSession?: SessionPocket
}

export interface CaptureOptions {
  includeCookies: boolean
  includeLocalStorage: boolean
  includeSessionStorage: boolean
  includeIndexedDB: boolean
}

export interface StorageSizeEstimate {
  cookies: { count: number; bytes: number }
  localStorage: { count: number; bytes: number }
  sessionStorage: { count: number; bytes: number }
  indexedDB: { count: number; bytes: number; dbCount?: number }
  totalBytes: number
}

export type ExportFormat = "spz" | "json"

export interface ExportFilterOptions {
  format: ExportFormat
  includeCookies: boolean
  includeStorage: boolean
  includeIndexedDB: boolean
}


