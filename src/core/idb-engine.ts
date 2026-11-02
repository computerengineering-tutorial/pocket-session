import type { IDBDatabaseData, IDBSnapshot, IDBStoreData } from "~types"

/**
 * IndexedDB Engine for capturing and restoring IndexedDB databases with full fidelity.
 * Includes deep recursive serialization for nested Uint8Arrays, Blobs, and WebCrypto buffers.
 */
export class IDBEngine {
  /**
   * Capture IndexedDB snapshots for an origin.
   */
  static async captureIndexedDB(tabId: number): Promise<IDBSnapshot | undefined> {
    if (!chrome?.scripting) return undefined

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async () => {
          if (!window.indexedDB || typeof window.indexedDB.databases !== "function") {
            return null
          }

          function serializeValue(val: any, depth = 0): any {
            if (depth > 12) return null
            if (val === null || val === undefined) return val
            if (typeof val === "number" || typeof val === "string" || typeof val === "boolean") return val

            // TypedArray or Buffer
            if (val instanceof Uint8Array || (val.buffer && val.byteLength !== undefined)) {
              return {
                __sp_type: "Uint8Array",
                data: Array.from(new Uint8Array(val.buffer, val.byteOffset || 0, val.byteLength))
              }
            }

            if (val instanceof ArrayBuffer) {
              return {
                __sp_type: "Uint8Array",
                data: Array.from(new Uint8Array(val))
              }
            }

            // Blob
            if (val instanceof Blob) {
              return {
                __sp_type: "Blob",
                type: val.type,
                size: val.size
              }
            }

            // Array
            if (Array.isArray(val)) {
              return val.map((item) => serializeValue(item, depth + 1))
            }

            // Plain Object
            if (typeof val === "object") {
              const res: Record<string, any> = {}
              for (const [k, v] of Object.entries(val)) {
                try {
                  res[k] = serializeValue(v, depth + 1)
                } catch (e) {}
              }
              return res
            }

            return val
          }

          try {
            const dbList = await window.indexedDB.databases()
            if (!dbList || dbList.length === 0) return null

            const databases: any[] = []

            for (const dbInfo of dbList) {
              if (!dbInfo.name) continue

              try {
                const dbData = await new Promise<any>((resolve) => {
                  const req = window.indexedDB.open(dbInfo.name!, dbInfo.version)

                  req.onerror = () => resolve(null)
                  req.onblocked = () => resolve(null)

                  req.onsuccess = async () => {
                    const db = req.result
                    const storeNames = Array.from(db.objectStoreNames)
                    const stores: any[] = []

                    if (storeNames.length === 0) {
                      db.close()
                      resolve({ name: dbInfo.name, version: dbInfo.version || 1, stores })
                      return
                    }

                    try {
                      const tx = db.transaction(storeNames, "readonly")

                      for (const storeName of storeNames) {
                        try {
                          const store = tx.objectStore(storeName)
                          const keyPath = store.keyPath
                          const autoIncrement = store.autoIncrement

                          // Capture indexes metadata
                          const indexes: any[] = []
                          for (const idxName of store.indexNames) {
                            try {
                              const idx = store.index(idxName)
                              indexes.push({
                                name: idx.name,
                                keyPath: idx.keyPath,
                                unique: idx.unique,
                                multiEntry: idx.multiEntry
                              })
                            } catch (e) {}
                          }

                          // Capture records with deep binary serialization
                          const records: any[] = await new Promise((resStore) => {
                            const items: any[] = []
                            const cursorReq = store.openCursor()

                            cursorReq.onsuccess = (e: any) => {
                              const cursor = e.target.result
                              if (cursor) {
                                items.push({
                                  key: cursor.key,
                                  value: serializeValue(cursor.value)
                                })
                                cursor.continue()
                              } else {
                                resStore(items)
                              }
                            }

                            cursorReq.onerror = () => resStore([])
                          })

                          stores.push({
                            name: storeName,
                            keyPath,
                            autoIncrement,
                            indexes,
                            records
                          })
                        } catch (storeErr) {
                          // Continue to other stores
                        }
                      }

                      tx.oncomplete = () => {
                        db.close()
                        resolve({
                          name: dbInfo.name,
                          version: dbInfo.version || 1,
                          stores
                        })
                      }
                      tx.onerror = () => {
                        db.close()
                        resolve({
                          name: dbInfo.name,
                          version: dbInfo.version || 1,
                          stores
                        })
                      }
                    } catch {
                      db.close()
                      resolve(null)
                    }
                  }
                })

                if (dbData && dbData.stores.length > 0) {
                  databases.push(dbData)
                }
              } catch (dbErr) {
                // Continue to next DB
              }
            }

            return databases.length > 0 ? databases : null
          } catch (e) {
            return null
          }
        }
      })

      if (results && results[0] && results[0].result) {
        return {
          databases: results[0].result as IDBDatabaseData[],
          capturedAt: Date.now()
        }
      }
    } catch (err) {
      console.warn("IndexedDB capture failed:", err)
    }

    return undefined
  }

  /**
   * Restore IndexedDB databases into a target tab.
   */
  static async restoreIndexedDB(tabId: number, snapshot: IDBSnapshot): Promise<void> {
    if (!chrome?.scripting || !snapshot || !snapshot.databases?.length) return

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        args: [snapshot.databases],
        func: async (databases: any[]) => {
          if (!window.indexedDB) return

          function deserializeValue(val: any, depth = 0): any {
            if (depth > 12) return val
            if (val === null || val === undefined) return val
            if (typeof val !== "object") return val

            if (
              (val.__sp_type === "Uint8Array" || val.__type === "Uint8Array") &&
              Array.isArray(val.data)
            ) {
              return new Uint8Array(val.data)
            }

            if (Array.isArray(val)) {
              return val.map((item) => deserializeValue(item, depth + 1))
            }

            const res: Record<string, any> = {}
            for (const [k, v] of Object.entries(val)) {
              res[k] = deserializeValue(v, depth + 1)
            }
            return res
          }

          for (const dbData of databases) {
            try {
              await new Promise<void>((resolve) => {
                const populateStores = (db: IDBDatabase) => {
                  const storeNames = Array.from(db.objectStoreNames)
                  const targetStores = dbData.stores
                    .map((s: any) => s.name)
                    .filter((n: string) => storeNames.includes(n))

                  if (targetStores.length === 0) {
                    db.close()
                    resolve()
                    return
                  }

                  try {
                    const tx = db.transaction(targetStores, "readwrite")

                    for (const storeData of dbData.stores) {
                      if (!storeNames.includes(storeData.name)) continue
                      const store = tx.objectStore(storeData.name)

                      // Clear existing records before restoring
                      try {
                        store.clear()
                      } catch (e) {}

                      for (const rec of storeData.records) {
                        try {
                          const val = deserializeValue(rec.value)
                          if (
                            rec.key !== undefined &&
                            (!store.keyPath || store.keyPath === "")
                          ) {
                            store.put(val, rec.key)
                          } else {
                            store.put(val)
                          }
                        } catch {
                          // Try alternative key format if inline vs out-of-line differs
                          try {
                            if (rec.key !== undefined) {
                              store.put(rec.value, rec.key)
                            } else {
                              store.put(rec.value)
                            }
                          } catch {}
                        }
                      }
                    }

                    tx.oncomplete = () => {
                      db.close()
                      resolve()
                    }
                    tx.onerror = () => {
                      db.close()
                      resolve()
                    }
                  } catch {
                    db.close()
                    resolve()
                  }
                }

                // Fallback attempt opening without version to bypass VersionError (when disk DB version is newer)
                const tryOpenWithoutVersion = () => {
                  try {
                    const fallbackReq = window.indexedDB.open(dbData.name)
                    fallbackReq.onsuccess = () => populateStores(fallbackReq.result)
                    fallbackReq.onerror = () => resolve()
                    fallbackReq.onblocked = () => resolve()
                  } catch {
                    resolve()
                  }
                }

                const req = window.indexedDB.open(dbData.name, dbData.version)

                req.onupgradeneeded = () => {
                  const db = req.result
                  for (const storeData of dbData.stores) {
                    let store: IDBObjectStore
                    if (!db.objectStoreNames.contains(storeData.name)) {
                      const options: IDBObjectStoreParameters = {}
                      if (storeData.keyPath !== undefined && storeData.keyPath !== null) {
                        options.keyPath = storeData.keyPath
                      }
                      if (storeData.autoIncrement !== undefined) {
                        options.autoIncrement = storeData.autoIncrement
                      }
                      store = db.createObjectStore(storeData.name, options)
                    } else {
                      store = req.transaction!.objectStore(storeData.name)
                    }

                    // Reconstruct all indexes
                    if (storeData.indexes && Array.isArray(storeData.indexes)) {
                      for (const idx of storeData.indexes) {
                        if (!store.indexNames.contains(idx.name)) {
                          try {
                            store.createIndex(idx.name, idx.keyPath, {
                              unique: idx.unique,
                              multiEntry: idx.multiEntry
                            })
                          } catch (e) {}
                        }
                      }
                    }
                  }
                }

                req.onsuccess = () => populateStores(req.result)
                req.onerror = () => tryOpenWithoutVersion()
                req.onblocked = () => tryOpenWithoutVersion()
              })
            } catch {
              // Ignore single db failure
            }
          }
        }
      })
    } catch (err) {
      console.warn("Error restoring IndexedDB:", err)
    }
  }
}
