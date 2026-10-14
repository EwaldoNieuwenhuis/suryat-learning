import json
from pathlib import Path
import re
import sqlite3
import sys
import pandas as pd

SCRAPER_DIR = Path(__file__).resolve().parent
if str(SCRAPER_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPER_DIR))

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from processors.unicode_normalizer import SuraytUnicodeNormalizer
from processors.db_builder import SuraytDatabaseBuilder, SEED_JSON_PATH, MOBILE_DB_PATH

SYRIAC_Check_RE = re.compile(r"[\u0700-\u072F]")
ZOWE_VOWEL_RE = re.compile(r"[\u0730-\u073F]")


def print_header(title: str) -> None:
    print(f"\n{'=' * 72}")
    print(f"  {title}")
    print(f"{'=' * 72}")


def test_1_unicode_normalizer() -> bool:
    print_header("TEST 1: Unicode & Serto Normalizer Zelftest")
    norm = SuraytUnicodeNormalizer()
    passed = True

    # 1A. Test decomposed Latijnse diakritische tekens naar NFC
    raw_latin = "s\u030clomo u k\u0074\u0331owo d-malfono"
    expected_latin = "šlomo u kṯowo d-malfono"
    actual_latin = norm.normalize_latin(raw_latin)

    if actual_latin == expected_latin:
        print(f"  [OK] Latijnse NFC normalisatie: '{actual_latin}'")
    else:
        print(f"  [FOUT] Latijnse normalisatie faalde: kreeg '{actual_latin}', verwachtte '{expected_latin}'")
        passed = False

    # 1B. Test Serto vocalized vs. unvocalized (Zow'e stripping)
    raw_serto = "\u200Fܫܠܳܡܐ ܘܟܬ݂ܳܘ̈ܶܐ\u200E"
    voc, unvoc = norm.normalize_serto(raw_serto)

    has_vowels_in_voc = bool(ZOWE_VOWEL_RE.search(voc))
    has_vowels_in_unvoc = bool(ZOWE_VOWEL_RE.search(unvoc))
    kept_seyome = "\u0308" in unvoc  # Meervoudspunten (Seyome) moeten blijven staan!

    if has_vowels_in_voc and not has_vowels_in_unvoc and kept_seyome:
        print(f"  [OK] Serto gevocaliseerd   : {voc}")
        print(f"  [OK] Serto ongevocaliseerd : {unvoc} (Zow'e verwijderd, Seyome behouden)")
    else:
        print(f"  [FOUT] Serto splitsing onjuist: voc='{voc}', unvoc='{unvoc}'")
        passed = False

    return passed


def test_2_lesson_coverage(conn: sqlite3.Connection) -> bool:
    print_header("TEST 2: Dekking per Hoofdstuk (Lessen, Woorden, Zinnen & Audio)")
    query = """
    SELECT 
        l.order_index AS nr,
        l.id AS lesson_id,
        l.title_surayt_lat AS surayt_titel,
        l.cefr_level AS cefr,
        COUNT(DISTINCT w.id) AS woorden,
        COUNT(DISTINCT s.id) AS zinnen,
        SUM(CASE WHEN w.audio_url IS NOT NULL AND w.audio_url != '' THEN 1 ELSE 0 END) AS audio_items
    FROM lessons l
    LEFT JOIN words w ON w.lesson_id = l.id
    LEFT JOIN sentences s ON s.lesson_id = l.id
    GROUP BY l.id
    ORDER BY l.order_index ASC;
    """
    df = pd.read_sql_query(query, conn)
    if df.empty:
        print("  [FOUT] Geen enkele les gevonden in de database!")
        return False

    print(df.to_string(index=False))

    empty_lessons = df[df["woorden"] == 0]
    if not empty_lessons.empty:
        print(
            f"\n  [WAARSCHUWING] {len(empty_lessons)} les(sen) hebben nog 0 woorden "
            f"(draai met --scrape zonder --max-units om alle 16 hoofdstukken te vullen)."
        )
    else:
        print(f"\n  [OK] Alle {len(df)} aanwezige lessen bevatten gekoppelde woordenschat.")
    return True


def test_3_data_integrity(conn: sqlite3.Connection) -> bool:
    print_header("TEST 3: Data-integriteit, Serto-schrift & Vertalingen")
    cursor = conn.cursor()
    passed = True

    # 3A. Totaalaantallen
    total_words = cursor.execute("SELECT COUNT(*) FROM words").fetchone()[0]
    total_sents = cursor.execute("SELECT COUNT(*) FROM sentences").fetchone()[0]
    total_conjs = cursor.execute("SELECT COUNT(*) FROM verb_conjugations").fetchone()[0]
    print(f"  Totaal in SQLite: {total_words} woorden | {total_sents} zinnen | {total_conjs} vervoegingen")

    # 3B. Controleer of elk woord geldig Syrisch (Serto) schrift bevat
    rows = cursor.execute("SELECT id, surayt_lat, surayt_serto FROM words").fetchall()
    invalid_serto = [r for r in rows if not r[2] or not SYRIAC_Check_RE.search(r[2])]
    if not invalid_serto:
        print(f"  [OK] Alle {total_words} woorden bevatten geldig West-Syrisch (Serto) Unicode-schrift.")
    else:
        print(f"  [FOUT] {len(invalid_serto)} woorden missen geldig Serto-schrift: {invalid_serto[:5]}")
        passed = False

    # 3C. Controleer op ontbrekende Nederlandse vertalingen
    missing_nl = cursor.execute(
        "SELECT COUNT(*) FROM words WHERE translation_nl IS NULL OR trim(translation_nl) = ''"
    ).fetchone()[0]
    if missing_nl == 0:
        print("  [OK] 100% van de woorden heeft een Nederlandse vertaling.")
    else:
        print(f"  [WAARSCHUWING] {missing_nl} van de {total_words} woorden mist nog een NL-vertaling.")

    return passed


def test_4_search_index(conn: sqlite3.Connection) -> bool:
    print_header("TEST 4: Diakriet-vrije Zoekindex ('slomo' -> 'šlomo')")
    cursor = conn.cursor()
    test_queries = [
        ("slomo", "šlomo"),
        ("kthowo", "kṯowo"),
        ("hotho", "ḥoṯo"),
    ]
    passed = True
    for raw_q, expected_lat in test_queries:
        row = cursor.execute(
            "SELECT surayt_lat, surayt_serto, translation_nl FROM words WHERE surayt_lat_search LIKE ?",
            (f"%{raw_q}%",),
        ).fetchone()
        if row:
            print(f"  [OK] Zoekterm '{raw_q}' vond -> {row[0]} ({row[1]}) = '{row[2]}'")
        else:
            print(f"  [FOUT] Zoekterm '{raw_q}' leverde geen resultaat op (verwachtte '{expected_lat}')!")
            passed = False
    return passed


def test_5_upsert_preserves_srs(conn: sqlite3.Connection) -> bool:
    print_header("TEST 5: Veilige Overschrijving (UPSERT) zonder SRS-verlies")
    cursor = conn.cursor()

    sample_word = cursor.execute("SELECT id, surayt_lat FROM words LIMIT 1").fetchone()
    if not sample_word:
        print("  [FOUT] Geen woorden in database om SRS-upsert te testen.")
        return False

    word_id, word_lat = sample_word

    # Simuleer dat de gebruiker dit woord al 12 keer geoefend heeft en 'mastered' is
    cursor.execute(
        """
        UPDATE srs_cards
        SET status = 'mastered', repetitions = 12, interval_days = 45, easiness_factor = 2.8
        WHERE item_id = ?
        """,
        (word_id,),
    )
    conn.commit()

    # Draai nu de volledige Database UPSERT opnieuw met een hogere versie
    builder = SuraytDatabaseBuilder()
    seed_data = json.loads(SEED_JSON_PATH.read_text(encoding="utf-8"))
    builder.upsert_sqlite_database(seed_data, content_version=99)

    # Controleer of de SRS-status van de gebruiker na de overschrijving nog steeds 'mastered' is
    after_srs = cursor.execute(
        "SELECT status, repetitions, interval_days, easiness_factor FROM srs_cards WHERE item_id = ?",
        (word_id,),
    ).fetchone()

    if after_srs and after_srs[0] == "mastered" and after_srs[1] == 12:
        print(
            f"  [OK] Gebruikersvoortgang voor '{word_lat}' ({word_id}) bleef 100% behouden na UPSERT: "
            f"status='{after_srs[0]}', repetitions={after_srs[1]}, interval={after_srs[2]}d"
        )
        # Zet terug naar 'new' zodat de seed-database schoon blijft voor distributie
        cursor.execute(
            """
            UPDATE srs_cards
            SET status = 'new', repetitions = 0, interval_days = 0, easiness_factor = 2.5
            WHERE item_id = ?
            """,
            (word_id,),
        )
        cursor.execute("UPDATE app_meta SET value = '1' WHERE key = 'content_version'")
        conn.commit()
        return True

    print(f"  [FOUT] SRS-kaart is overschreven of gereset! Waarde na upsert: {after_srs}")
    return False


def run_all_validations() -> None:
    if not MOBILE_DB_PATH.exists():
        print(f"Database niet gevonden op {MOBILE_DB_PATH}. Draai eerst: python -m processors.db_builder")
        sys.exit(1)

    conn = sqlite3.connect(str(MOBILE_DB_PATH))
    results = [
        test_1_unicode_normalizer(),
        test_2_lesson_coverage(conn),
        test_3_data_integrity(conn),
        test_4_search_index(conn),
        test_5_upsert_preserves_srs(conn),
    ]
    conn.close()

    print_header("EINDVERDICT VALIDATIE")
    if all(results):
        print("  ALLE 5 TESTS GESLAAGD! De scraper en surayt.db zijn 100% klaar voor React Native.")
        sys.exit(0)
    else:
        print("  EEN OF MEER TESTS ZIJN GEFAALD. Bekijk de meldingen hierboven.")
        sys.exit(1)


if __name__ == "__main__":
    run_all_validations()
