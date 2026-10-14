import initSqlJs, { Database } from "sql.js";
import { drizzle, SQLJsDatabase } from "drizzle-orm/sql-js";
import { Asset } from "expo-asset";
import * as schema from "./schema";

let sqlJsDbInstance: Database | null = null;
let drizzleInstance: SQLJsDatabase<typeof schema> | null = null;

export interface RawSqliteSyncAdapter {
  getAllSync<T = any>(query: string, params?: any[]): T[];
  getFirstSync<T = any>(query: string, params?: any[]): T | null;
  execSync(sql: string): void;
  runSync(sql: string, params?: any[]): { changes: number; lastInsertRowId: number };
}

let rawSqliteAdapter: RawSqliteSyncAdapter | null = null;

/**
 * Normaliseert query parameters voor sql.js (bijv. booleans naar 0/1).
 */
function normalizeParams(params?: any[]): any[] {
  if (!params || !Array.isArray(params)) return [];
  return params.map((p) => {
    if (typeof p === "boolean") return p ? 1 : 0;
    if (p === undefined) return null;
    return p;
  });
}

/**
 * Initialiseert de SQLite database in de browser via sql.js (WebAssembly).
 * Laadt exact hetzelfde gebundelde surayt.db bestand als op Android en iOS.
 */
export async function initializeDatabase(): Promise<SQLJsDatabase<typeof schema>> {
  if (drizzleInstance) {
    return drizzleInstance;
  }

  // 1. Haal de gebundelde surayt.db asset op
  const asset = Asset.fromModule(require("../../assets/database/surayt.db"));
  await asset.downloadAsync();
  const dbUri = asset.localUri || asset.uri;

  if (!dbUri) {
    throw new Error("Kon gebundelde surayt.db asset niet laden op het web.");
  }

  // 2. Download parallel de database data en de WebAssembly binary
  const [dbResponse, wasmResponse] = await Promise.all([
    fetch(dbUri),
    fetch("https://sql.js.org/dist/sql-wasm.wasm"),
  ]);

  if (!dbResponse.ok) {
    throw new Error(`Fout bij downloaden van surayt.db: HTTP status ${dbResponse.status}`);
  }
  if (!wasmResponse.ok) {
    throw new Error(`Fout bij downloaden van sql-wasm.wasm: HTTP status ${wasmResponse.status}`);
  }

  const [dbBuffer, wasmBinary] = await Promise.all([
    dbResponse.arrayBuffer(),
    wasmResponse.arrayBuffer(),
  ]);

  // 3. Initialiseer sql.js WebAssembly met de gedownloade binary (voorkomt Metro MIME-type fouten)
  const SQL = await initSqlJs({ wasmBinary });

  sqlJsDbInstance = new SQL.Database(new Uint8Array(dbBuffer));

  // 4. Bouw de synchrone adapter die compatibel is met expo-sqlite's SQLiteDatabase interface
  rawSqliteAdapter = {
    getAllSync<T = any>(query: string, params: any[] = []): T[] {
      if (!sqlJsDbInstance) {
        throw new Error("SQLite instance is nog niet geïnitialiseerd.");
      }
      const stmt = sqlJsDbInstance.prepare(query);
      const cleanParams = normalizeParams(params);
      if (cleanParams.length > 0) {
        stmt.bind(cleanParams);
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return rows;
    },

    getFirstSync<T = any>(query: string, params: any[] = []): T | null {
      if (!sqlJsDbInstance) {
        throw new Error("SQLite instance is nog niet geïnitialiseerd.");
      }
      const stmt = sqlJsDbInstance.prepare(query);
      const cleanParams = normalizeParams(params);
      if (cleanParams.length > 0) {
        stmt.bind(cleanParams);
      }
      let row: T | null = null;
      if (stmt.step()) {
        row = stmt.getAsObject() as T;
      }
      stmt.free();
      return row;
    },

    execSync(sql: string): void {
      if (!sqlJsDbInstance) {
        throw new Error("SQLite instance is nog niet geïnitialiseerd.");
      }
      sqlJsDbInstance.exec(sql);
    },

    runSync(sql: string, params: any[] = []): { changes: number; lastInsertRowId: number } {
      if (!sqlJsDbInstance) {
        throw new Error("SQLite instance is nog niet geïnitialiseerd.");
      }
      const cleanParams = normalizeParams(params);
      sqlJsDbInstance.run(sql, cleanParams);
      return {
        changes: sqlJsDbInstance.getRowsModified(),
        lastInsertRowId: 0,
      };
    },
  };

  // 5. Initialiseer Drizzle ORM met de sql.js driver
  drizzleInstance = drizzle(sqlJsDbInstance, { schema });
  return drizzleInstance;
}

export function getDb(): SQLJsDatabase<typeof schema> {
  if (!drizzleInstance) {
    throw new Error("Database is nog niet geïnitialiseerd. Roep eerst initializeDatabase() aan.");
  }
  return drizzleInstance;
}

export function getRawSqlite(): RawSqliteSyncAdapter {
  if (!rawSqliteAdapter) {
    throw new Error("SQLite instance is nog niet geïnitialiseerd.");
  }
  return rawSqliteAdapter;
}
