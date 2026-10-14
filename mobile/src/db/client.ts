import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { drizzle, ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";

const DB_NAME = "surayt.db";
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite`;
const LOCAL_DB_URI = `${SQLITE_DIR}/${DB_NAME}`;

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

  const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
  }

  // Resolve het gebundelde surayt.db bestand uit mobile/assets/database/surayt.db
  const asset = Asset.fromModule(require("../../assets/database/surayt.db"));
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Kon gebundelde surayt.db asset niet laden.");
  }

  const localDbInfo = await FileSystem.getInfoAsync(LOCAL_DB_URI);

  if (!localDbInfo.exists) {
    // Eerste installatie: kopieer de voorgevulde database direct
    await FileSystem.copyAsync({
      from: asset.localUri,
      to: LOCAL_DB_URI,
    });
  } else {
    // Bestaande installatie: controleer of de bundel een nieuwere content_version bevat
    await syncBundledContentIfNeeded(asset.localUri);
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
  const tempSeedPath = `${SQLITE_DIR}/surayt_seed_tmp.db`;
  await FileSystem.copyAsync({ from: bundledAssetUri, to: tempSeedPath });

  const db = SQLite.openDatabaseSync(DB_NAME);
  const cleanAttachPath = tempSeedPath.replace("file://", "");

  try {
    db.execSync(`ATTACH DATABASE '${cleanAttachPath}' AS bundled_seed;`);

    const localVersionRow = db.getFirstSync<{ value: string }>(
      "SELECT value FROM main.app_meta WHERE key = 'content_version'"
    );
    const bundledVersionRow = db.getFirstSync<{ value: string }>(
      "SELECT value FROM bundled_seed.app_meta WHERE key = 'content_version'"
    );

    const localVer = parseInt(localVersionRow?.value ?? "0", 10);
    const bundledVer = parseInt(bundledVersionRow?.value ?? "1", 10);

    if (bundledVer > localVer) {
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
    }

    db.execSync("DETACH DATABASE bundled_seed;");
  } finally {
    db.closeSync();
    await FileSystem.deleteAsync(tempSeedPath, { idempotent: true });
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
