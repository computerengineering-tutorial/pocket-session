import * as z from "zod"

export const SameSiteSchema = z.enum(["unspecified", "no_restriction", "lax", "strict"])

export const SessionCookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string(),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  sameSite: SameSiteSchema,
  expirationDate: z.number().optional(),
  hostOnly: z.boolean().optional(),
  session: z.boolean().optional(),
  partitionKey: z
    .object({
      topLevelSite: z.string().optional()
    })
    .optional()
})

export const StorageDataSchema = z.object({
  localStorage: z.record(z.string(), z.string()).default({}),
  sessionStorage: z.record(z.string(), z.string()).default({})
})

export const IDBRecordSchema = z.object({
  key: z.any().optional(),
  value: z.any()
})

export const IDBIndexDataSchema = z.object({
  name: z.string(),
  keyPath: z.any(),
  unique: z.boolean().default(false),
  multiEntry: z.boolean().default(false)
})

export const IDBStoreDataSchema = z.object({
  name: z.string(),
  keyPath: z.any().optional(),
  autoIncrement: z.boolean().default(false),
  indexes: z.array(IDBIndexDataSchema).default([]),
  records: z.array(IDBRecordSchema).default([])
})

export const IDBDatabaseDataSchema = z.object({
  name: z.string(),
  version: z.number(),
  stores: z.array(IDBStoreDataSchema).default([])
})

export const IDBSnapshotSchema = z.object({
  databases: z.array(IDBDatabaseDataSchema).default([]),
  capturedAt: z.number()
})

export const ColorTagSchema = z.enum([
  "indigo",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "purple",
  "slate"
])

export const SessionPocketSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  tag: ColorTagSchema.default("indigo"),
  url: z.string(),
  domain: z.string(),
  apexDomain: z.string(),
  origin: z.string(),
  faviconUrl: z.string().optional(),
  createdAt: z.number(),
  lastUsedAt: z.number(),
  lastSavedAt: z.number(),
  cookies: z.array(SessionCookieSchema).default([]),
  storage: StorageDataSchema.default({ localStorage: {}, sessionStorage: {} }),
  idbSnapshot: IDBSnapshotSchema.optional(),
  notes: z.string().optional()
})

export const PocketSettingsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).default("dark"),
  autoSyncOnSwitch: z.boolean().default(true),
  confirmBeforeDelete: z.boolean().default(true),
  showActiveBadge: z.boolean().default(true)
})

export const SessionPocketStoreSchema = z.object({
  version: z.number().default(1),
  sessions: z.record(z.string(), SessionPocketSchema).default({}),
  activeSessions: z.record(z.string(), z.string()).default({}),
  settings: PocketSettingsSchema.default({
    theme: "dark",
    autoSyncOnSwitch: true,
    confirmBeforeDelete: true,
    showActiveBadge: true
  })
})

export const ExportDataSchema = z.object({
  format: z.literal("sessionpocket-backup"),
  version: z.number(),
  exportedAt: z.number(),
  sessions: z.array(SessionPocketSchema),
  settings: PocketSettingsSchema.optional()
})

export const FlexibleImportSchema = z.union([
  ExportDataSchema,
  z.array(SessionPocketSchema),
  SessionPocketSchema
])

export type ExportData = z.infer<typeof ExportDataSchema>

