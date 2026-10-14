import * as SQLite from "expo-sqlite";
import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { drizzle, ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";

const DB_NAME = "surayt.db";
const sqliteDir = new Directory(Paths.document, "SQLite");
const localDbFile = new File(sqliteDir, DB_NAME);

let sqliteInstance: SQLite.SQLiteDatabase | null = null;
let drizzleInstance: ExpoSQLiteDatabase<typeof schema> | null = null;

/**
 * Initialiseert de lokale SQLite database en synchroniseert nieuwe gescrapete lessen/woorden
 * uit de meegeleverde asset-database zonder gebruikersvoortgang (SRS/Streaks) te wissen.
 */
export async function initializeDatabase(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  if (drizzleInstance) {
    return drizzleInstance;
  }

  if (!sqliteDir.exists) {
    sqliteDir.create({ idempotent: true });
  }

  // Resolve het gebundelde surayt.db bestand uit mobile/assets/database/surayt.db
  const asset = Asset.fromModule(require("../../assets/database/surayt.db"));
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Kon gebundelde surayt.db asset niet laden.");
  }

  // Controleer of de lokale database al bestaat EN daadwerkelijk de vereiste tabellen bevat
  let isPopulated = false;
  if (localDbFile.exists) {
    try {
      const checkDb = SQLite.openDatabaseSync(DB_NAME);
      const row = checkDb.getFirstSync<{ count: number }>(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='lessons';"
      );
      checkDb.closeSync();
      isPopulated = (row?.count ?? 0) > 0;
    } catch {
      isPopulated = false;
    }
  }

  if (!isPopulated) {
    // Eerste installatie of lege/corrupte lokale database: kopieer de voorgevulde database
    if (localDbFile.exists) {
      try {
        localDbFile.delete();
      } catch {}
    }
    const assetFile = new File(asset.localUri);
    await assetFile.copy(localDbFile);
  } else {
    // Bestaande gevulde installatie: controleer of de bundel een nieuwere content_version bevat
    try {
      await syncBundledContentIfNeeded(asset.localUri);
    } catch (syncErr) {
      console.warn("Kon gebundelde database niet synchroniseren, gebruik bestaande lokale database:", syncErr);
    }
  }

  sqliteInstance = SQLite.openDatabaseSync(DB_NAME);
  sqliteInstance.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  drizzleInstance = drizzle(sqliteInstance, { schema });
  return drizzleInstance;
}

/**
 * Vergelijkt 'content_version' tussen de lokale gebruikersdatabase en de nieuwe app-bundel.
 * Voert bij een nieuwere versie een niet-destructieve UPSERT uit via ATTACH DATABASE.
 */
async function syncBundledContentIfNeeded(bundledAssetUri: string): Promise<void> {
  const tempSeedFile = new File(sqliteDir, "surayt_seed_tmp.db");
  const assetFile = new File(bundledAssetUri);
  await assetFile.copy(tempSeedFile);

  try {
    // Controleer versienummers zonder ATTACH DATABASE
    const seedDb = SQLite.openDatabaseSync("surayt_seed_tmp.db");
    const bundledVersionRow = seedDb.getFirstSync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'content_version'"
    );
    seedDb.closeSync();

    const db = SQLite.openDatabaseSync(DB_NAME);
    let localVersionRow: { value: string } | null = null;
    try {
      localVersionRow = db.getFirstSync<{ value: string }>(
        "SELECT value FROM main.app_meta WHERE key = 'content_version'"
      );
    } catch {}

    const localVer = parseInt(localVersionRow?.value ?? "0", 10);
    const bundledVer = parseInt(bundledVersionRow?.value ?? "1", 10);

    if (bundledVer <= localVer) {
      // Reeds up-to-date, geen ATTACH of migratie nodig
      db.closeSync();
      return;
    }

    // Alleen bij een nieuwere versie voeren we ATTACH DATABASE uit
    let cleanAttachPath = tempSeedFile.uri.replace(/^file:\/\//, "");
    cleanAttachPath = decodeURI(cleanAttachPath);

    try {
      db.execSync(`ATTACH DATABASE '${cleanAttachPath}' AS bundled_seed;`);

      db.execSync(`
        BEGIN TRANSACTION;

        INSERT INTO main.lessons
        SELECT * FROM bundled_seed.lessons
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          title_nl = excluded.title_nl,
          title_surayt_lat = excluded.title_surayt_lat,
          title_surayt_serto = excluded.title_surayt_serto,
          location_theme = excluded.location_theme,
          cefr_level = excluded.cefr_level,
          order_index = excluded.order_index,
          description_nl = excluded.description_nl;

        INSERT INTO main.words
        SELECT * FROM bundled_seed.words
        ON CONFLICT(id) DO UPDATE SET
          lesson_id = excluded.lesson_id,
          surayt_lat = excluded.surayt_lat,
          surayt_lat_search = excluded.surayt_lat_search,
          surayt_serto = excluded.surayt_serto,
          surayt_serto_unvocalized = excluded.surayt_serto_unvocalized,
          root_radicals = COALESCE(excluded.root_radicals, main.words.root_radicals),
          part_of_speech = excluded.part_of_speech,
          gender = COALESCE(excluded.gender, main.words.gender),
          plural_lat = COALESCE(excluded.plural_lat, main.words.plural_lat),
          plural_serto = COALESCE(excluded.plural_serto, main.words.plural_serto),
          translation_nl = excluded.translation_nl,
          translation_en = excluded.translation_en,
          translation_de = excluded.translation_de,
          audio_url = COALESCE(excluded.audio_url, main.words.audio_url),
          audio_local = COALESCE(excluded.audio_local, main.words.audio_local),
          cefr_level = excluded.cefr_level,
          category = excluded.category;

        INSERT OR IGNORE INTO main.srs_cards (item_id, item_type, status, next_review_at)
        SELECT id, 'word', 'new', 0 FROM bundled_seed.words;

        INSERT INTO main.verb_conjugations (word_id, tense, person, surayt_lat, surayt_serto)
        SELECT word_id, tense, person, surayt_lat, surayt_serto FROM bundled_seed.verb_conjugations
        ON CONFLICT(word_id, tense, person) DO UPDATE SET
          surayt_lat = excluded.surayt_lat,
          surayt_serto = excluded.surayt_serto;

        INSERT INTO main.sentences
        SELECT * FROM bundled_seed.sentences
        ON CONFLICT(id) DO UPDATE SET
          lesson_id = excluded.lesson_id,
          surayt_lat = excluded.surayt_lat,
          surayt_serto = excluded.surayt_serto,
          surayt_serto_unvocalized = excluded.surayt_serto_unvocalized,
          translation_nl = excluded.translation_nl,
          translation_en = excluded.translation_en,
          translation_de = excluded.translation_de,
          cefr_level = excluded.cefr_level,
          category = excluded.category,
          audio_url = COALESCE(excluded.audio_url, main.sentences.audio_url),
          audio_local = COALESCE(excluded.audio_local, main.sentences.audio_local),
          word_tokens_json = excluded.word_tokens_json;

        INSERT INTO main.app_meta (key, value)
        VALUES ('content_version', '${bundledVer}')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;

        COMMIT;
      `);

      db.execSync("DETACH DATABASE bundled_seed;");
    } catch (attachErr) {
      console.warn("ATTACH DATABASE niet ondersteund op dit platform, bestaande data behouden:", attachErr);
    } finally {
      db.closeSync();
    }
  } finally {
    if (tempSeedFile.exists) {
      try {
        tempSeedFile.delete();
      } catch {}
    }
  }
}

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
  if (!drizzleInstance) {
    throw new Error("Database is nog niet geïnitialiseerd. Roep eerst initializeDatabase() aan.");
  }
  return drizzleInstance;
}

export function getRawSqlite(): SQLite.SQLiteDatabase {
  if (!sqliteInstance) {
    throw new Error("SQLite instance is nog niet geïnitialiseerd.");
  }
  return sqliteInstance;
}
