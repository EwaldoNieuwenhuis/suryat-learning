import argparse
import asyncio
import json
import logging
from pathlib import Path
import sqlite3
import sys
from typing import Any, Dict
import pandas as pd

SCRAPER_DIR = Path(__file__).resolve().parent.parent
if str(SCRAPER_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPER_DIR))

from processors.unicode_normalizer import SuraytUnicodeNormalizer
from scrapers.audio_downloader import SuraytAudioDownloader
from scrapers.slomo_surayt_scraper import SlomoSuraytScraper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SEED_JSON_PATH = SCRAPER_DIR / "surayt_seed.json"
MOBILE_DB_PATH = SCRAPER_DIR.parent / "mobile" / "assets" / "database" / "surayt.db"
MOBILE_ASSETS_DIR = SCRAPER_DIR.parent / "mobile" / "assets"


DDL_SCHEMA = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title_nl TEXT NOT NULL,
    title_surayt_lat TEXT NOT NULL,
    title_surayt_serto TEXT NOT NULL,
    location_theme TEXT NOT NULL,
    cefr_level TEXT NOT NULL DEFAULT 'A1',
    order_index INTEGER NOT NULL,
    description_nl TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
    surayt_lat TEXT NOT NULL,
    surayt_lat_search TEXT NOT NULL,
    surayt_serto TEXT NOT NULL,
    surayt_serto_unvocalized TEXT NOT NULL,
    root_radicals TEXT,
    part_of_speech TEXT NOT NULL,
    gender TEXT,
    plural_lat TEXT,
    plural_serto TEXT,
    translation_nl TEXT NOT NULL,
    translation_en TEXT NOT NULL,
    translation_de TEXT NOT NULL,
    audio_url TEXT,
    audio_local TEXT,
    cefr_level TEXT NOT NULL DEFAULT 'A1',
    category TEXT NOT NULL DEFAULT 'alledaags'
);

CREATE INDEX IF NOT EXISTS idx_words_lat_search ON words(surayt_lat_search);
CREATE INDEX IF NOT EXISTS idx_words_serto_unvoc ON words(surayt_serto_unvocalized);
CREATE INDEX IF NOT EXISTS idx_words_root ON words(root_radicals);
CREATE INDEX IF NOT EXISTS idx_words_category ON words(category);
CREATE INDEX IF NOT EXISTS idx_words_lesson ON words(lesson_id);

CREATE TABLE IF NOT EXISTS verb_conjugations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    tense TEXT NOT NULL,
    person TEXT NOT NULL,
    surayt_lat TEXT NOT NULL,
    surayt_serto TEXT NOT NULL,
    UNIQUE(word_id, tense, person)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conj_unique ON verb_conjugations(word_id, tense, person);

CREATE TABLE IF NOT EXISTS sentences (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
    surayt_lat TEXT NOT NULL,
    surayt_serto TEXT NOT NULL,
    surayt_serto_unvocalized TEXT NOT NULL,
    translation_nl TEXT NOT NULL,
    translation_en TEXT NOT NULL,
    translation_de TEXT NOT NULL,
    cefr_level TEXT NOT NULL DEFAULT 'A1',
    category TEXT NOT NULL,
    audio_url TEXT,
    audio_local TEXT,
    word_tokens_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS srs_cards (
    item_id TEXT PRIMARY KEY NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'word',
    status TEXT NOT NULL DEFAULT 'new',
    easiness_factor REAL NOT NULL DEFAULT 2.5,
    stability REAL NOT NULL DEFAULT 0.0,
    difficulty REAL NOT NULL DEFAULT 5.0,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    correct_streak INTEGER NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    avg_response_ms INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at INTEGER,
    next_review_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS srs_review_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    skill_pillar TEXT NOT NULL,
    rating INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    reviewed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_activity (
    date_iso TEXT PRIMARY KEY NOT NULL,
    study_seconds INTEGER NOT NULL DEFAULT 0,
    reviews_completed INTEGER NOT NULL DEFAULT 0,
    lessons_completed INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0
);
"""


class SuraytDatabaseBuilder:
    def __init__(self, seed_path: Path = SEED_JSON_PATH, db_path: Path = MOBILE_DB_PATH):
        self.seed_path = seed_path
        self.db_path = db_path
        self.normalizer = SuraytUnicodeNormalizer()

    @staticmethod
    def strip_latin_diacritics_for_search(surayt_lat: str) -> str:
        """Maakt zoeken op standaard QWERTY mogelijk (bijv. 'slomo' vindt 'šlomo', 'kthowo' vindt 'kṯowo')."""
        if not surayt_lat:
            return ""
        text = surayt_lat.lower().strip()
        simple_map = str.maketrans({
            "š": "s", "č": "c", "ġ": "g", "ḥ": "h",
            "ṭ": "t", "ṣ": "s", "ḏ": "d", "ṯ": "t",
            "ž": "z", "ë": "e", "ʻ": "", "'": "",
        })
        simple = text.translate(simple_map)
        digraph_replacements = {
            "š": "sh", "č": "ch", "ġ": "gh", "ḏ": "dh", "ṯ": "th", "ž": "zh",
            "ḥ": "h", "ṭ": "t", "ṣ": "s", "ë": "e", "ʻ": "", "'": "",
        }
        digraph = text
        for old, new in digraph_replacements.items():
            digraph = digraph.replace(old, new)

        if simple != digraph:
            return f"{simple} {digraph}"
        return simple

    def merge_scraped_into_seed(
        self, seed_data: Dict[str, Any], scraped_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Combineert de bestaande surayt_seed.json met vers gescrapete data van textbook.surayt.com.
        Bestaande items met dezelfde ID worden bijgewerkt, maar handmatig toegevoegde
        wortels (root_radicals) en vervoegingen in de seed blijven behouden als de scraper ze niet heeft.
        """
        lessons_map = {l["id"]: l for l in seed_data.get("lessons", [])}
        for s_lesson in scraped_data.get("lessons", []):
            lessons_map[s_lesson["id"]] = s_lesson

        words_map = {w["id"]: w for w in seed_data.get("words", [])}
        for s_word in scraped_data.get("words", []):
            existing = words_map.get(s_word["id"])
            if existing:
                # Behoud handmatig verrijkte wortels en vervoegingen
                if not s_word.get("root_radicals") and existing.get("root_radicals"):
                    s_word["root_radicals"] = existing["root_radicals"]
                if not s_word.get("conjugations") and existing.get("conjugations"):
                    s_word["conjugations"] = existing["conjugations"]
            words_map[s_word["id"]] = s_word

        sents_map = {s["id"]: s for s in seed_data.get("sentences", [])}
        for s_sent in scraped_data.get("sentences", []):
            sents_map[s_sent["id"]] = s_sent

        seed_data["lessons"] = sorted(lessons_map.values(), key=lambda x: x["order_index"])
        seed_data["words"] = list(words_map.values())
        seed_data["sentences"] = list(sents_map.values())
        return seed_data

    def upsert_sqlite_database(self, data: Dict[str, Any], content_version: int = 1) -> None:
        """
        Schrijft of overschrijft (UPSERT) alle lessen, woorden en zinnen in surayt.db
        ZONDER bestaande srs_cards of gebruikersvoortgang te wissen.
        """
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.executescript(DDL_SCHEMA)

        # Sla de content_version op zodat de React Native app weet wanneer hij moet synchroniseren
        cursor.execute(
            """
            INSERT INTO app_meta (key, value) VALUES ('content_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(content_version),),
        )

        # 1. UPSERT Lessons
        for lesson in data.get("lessons", []):
            cursor.execute(
                """
                INSERT INTO lessons (
                    id, slug, title_nl, title_surayt_lat, title_surayt_serto,
                    location_theme, cefr_level, order_index, description_nl
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    slug = excluded.slug,
                    title_nl = excluded.title_nl,
                    title_surayt_lat = excluded.title_surayt_lat,
                    title_surayt_serto = excluded.title_surayt_serto,
                    location_theme = excluded.location_theme,
                    cefr_level = excluded.cefr_level,
                    order_index = excluded.order_index,
                    description_nl = excluded.description_nl
                """,
                (
                    lesson["id"],
                    lesson["slug"],
                    lesson["title_nl"],
                    lesson["title_surayt_lat"],
                    lesson["title_surayt_serto"],
                    lesson["location_theme"],
                    lesson["cefr_level"],
                    lesson["order_index"],
                    lesson["description_nl"],
                ),
            )

        # 2. UPSERT Words & Conjugations
        for word in data.get("words", []):
            voc, unvoc = self.normalizer.normalize_serto(word["surayt_serto"])
            surayt_lat = self.normalizer.normalize_latin(word["surayt_lat"])
            search_key = self.strip_latin_diacritics_for_search(surayt_lat)
            trans = word.get("translations", {})

            cursor.execute(
                """
                INSERT INTO words (
                    id, lesson_id, surayt_lat, surayt_lat_search, surayt_serto,
                    surayt_serto_unvocalized, root_radicals, part_of_speech, gender,
                    plural_lat, plural_serto, translation_nl, translation_en,
                    translation_de, audio_url, audio_local, cefr_level, category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    lesson_id = excluded.lesson_id,
                    surayt_lat = excluded.surayt_lat,
                    surayt_lat_search = excluded.surayt_lat_search,
                    surayt_serto = excluded.surayt_serto,
                    surayt_serto_unvocalized = excluded.surayt_serto_unvocalized,
                    root_radicals = COALESCE(excluded.root_radicals, words.root_radicals),
                    part_of_speech = excluded.part_of_speech,
                    gender = COALESCE(excluded.gender, words.gender),
                    plural_lat = COALESCE(excluded.plural_lat, words.plural_lat),
                    plural_serto = COALESCE(excluded.plural_serto, words.plural_serto),
                    translation_nl = excluded.translation_nl,
                    translation_en = excluded.translation_en,
                    translation_de = excluded.translation_de,
                    audio_url = COALESCE(excluded.audio_url, words.audio_url),
                    audio_local = COALESCE(excluded.audio_local, words.audio_local),
                    cefr_level = excluded.cefr_level,
                    category = excluded.category
                """,
                (
                    word["id"],
                    word.get("lesson_id"),
                    surayt_lat,
                    search_key,
                    voc,
                    unvoc,
                    word.get("root_radicals"),
                    word.get("part_of_speech", "noun"),
                    word.get("gender"),
                    word.get("plural_lat"),
                    word.get("plural_serto"),
                    trans.get("nl", ""),
                    trans.get("en", ""),
                    trans.get("de", ""),
                    word.get("audio_url"),
                    word.get("audio_local"),
                    word.get("cefr_level", "A1"),
                    word.get("category", "alledaags"),
                ),
            )

            # INSERT OR IGNORE: Maak alleen een SRS-kaart aan als dit een nieuw woord is!
            cursor.execute(
                """
                INSERT OR IGNORE INTO srs_cards (item_id, item_type, status, next_review_at)
                VALUES (?, 'word', 'new', 0)
                """,
                (word["id"],),
            )

            for conj in word.get("conjugations", []):
                cursor.execute(
                    """
                    INSERT INTO verb_conjugations (word_id, tense, person, surayt_lat, surayt_serto)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(word_id, tense, person) DO UPDATE SET
                        surayt_lat = excluded.surayt_lat,
                        surayt_serto = excluded.surayt_serto
                    """,
                    (
                        word["id"],
                        conj["tense"],
                        conj["person"],
                        self.normalizer.normalize_latin(conj["surayt_lat"]),
                        self.normalizer.normalize_serto(conj["surayt_serto"])[0],
                    ),
                )

        # 3. UPSERT Sentences
        for sent in data.get("sentences", []):
            voc, unvoc = self.normalizer.normalize_serto(sent["surayt_serto"])
            surayt_lat = self.normalizer.normalize_latin(sent["surayt_lat"])
            trans = sent.get("translations", {})

            cursor.execute(
                """
                INSERT INTO sentences (
                    id, lesson_id, surayt_lat, surayt_serto, surayt_serto_unvocalized,
                    translation_nl, translation_en, translation_de, cefr_level,
                    category, audio_url, audio_local, word_tokens_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    audio_url = COALESCE(excluded.audio_url, sentences.audio_url),
                    audio_local = COALESCE(excluded.audio_local, sentences.audio_local),
                    word_tokens_json = excluded.word_tokens_json
                """,
                (
                    sent["id"],
                    sent.get("lesson_id"),
                    surayt_lat,
                    voc,
                    unvoc,
                    trans.get("nl", ""),
                    trans.get("en", ""),
                    trans.get("de", ""),
                    sent.get("cefr_level", "A1"),
                    sent.get("category", "alledaags"),
                    sent.get("audio_url"),
                    sent.get("audio_local"),
                    json.dumps(sent.get("word_tokens", []), ensure_ascii=False),
                ),
            )

        conn.commit()
        conn.close()
        logger.info(f"Database UPSERT voltooid (versie {content_version}): {self.db_path}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Surayt Scraper & SQLite Upsert Pipeline")
    parser.add_argument("--scrape", action="store_true", help="Scrape live lessen van textbook.surayt.com")
    parser.add_argument("--max-units", type=int, default=None, help="Beperk aantal te scrapen hoofdstukken (bijv. 4)")
    parser.add_argument("--download-audio", action="store_true", help="Download en normaliseer alle .mp3 bestanden")
    parser.add_argument("--version", type=int, default=1, help="Verhoog content_version voor app-migraties")
    args = parser.parse_args()

    builder = SuraytDatabaseBuilder()
    seed_data = json.loads(SEED_JSON_PATH.read_text(encoding="utf-8"))

    if args.scrape:
        logger.info("Start live scraping van Šlomo Surayt (textbook.surayt.com)...")
        scraper = SlomoSuraytScraper()
        scraped_data = await scraper.scrape_full_course(max_units=args.max_units)
        seed_data = builder.merge_scraped_into_seed(seed_data, scraped_data)
        # Sla de samengevoegde data direct op in surayt_seed.json
        SEED_JSON_PATH.write_text(
            json.dumps(seed_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    if args.download_audio:
        downloader = SuraytAudioDownloader(output_base_dir=MOBILE_ASSETS_DIR)
        all_media = seed_data.get("words", []) + seed_data.get("sentences", [])
        await downloader.download_batch(all_media)

    builder.upsert_sqlite_database(seed_data, content_version=args.version)


if __name__ == "__main__":
    asyncio.run(main())
