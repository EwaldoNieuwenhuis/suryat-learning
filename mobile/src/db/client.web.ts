import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";

/**
 * Web fallback voor src/db/client.ts.
 * expo-sqlite is een native C++/JSI module en werkt uitsluitend op iOS en Android (Expo Go / Development Build).
 * In een webbrowser toont de app een duidelijke melding in plaats van een fatale runtime crash.
 */
export async function initializeDatabase(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  throw new Error(
    "Šlomo Surayt gebruikt een lokale SQLite database (expo-sqlite) die uitsluitend beschikbaar is op iOS en Android.\n\n" +
    "Scan de QR-code in je terminal met de Expo Go app op je telefoon of start een Android Emulator (toets 'a' in de terminal)."
  );
}

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
  throw new Error("Database is niet beschikbaar op het web.");
}

export function getRawSqlite(): any {
  throw new Error("SQLite instance is niet beschikbaar op het web.");
}
