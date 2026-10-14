import asyncio
import hashlib
import logging
from pathlib import Path
import re
import sys
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin
from bs4 import BeautifulSoup, Tag
from playwright.async_api import async_playwright, Page

SCRAPER_DIR = Path(__file__).resolve().parent.parent
if str(SCRAPER_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPER_DIR))

from processors.unicode_normalizer import SuraytUnicodeNormalizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# De officiële 16 hoofdstukken van Šlomo Surayt Level A + hun culturele Tur Abdin thema's
SLOMO_SURAYT_UNITS = [
    {"unit": 1, "slug": "olafbeth-1", "lat": "Olafbeṯ I", "serto": "ܐܳܠܰܦܒܶܝܬ̣ ܐ", "nl": "Alfabet I", "vocab_sec": "1.6", "dial_sec": "1.1", "location": "Mor Gabriel", "category": "cultuur", "cefr": "A1"},
    {"unit": 2, "slug": "olafbeth-2", "lat": "Olafbeṯ II", "serto": "ܐܳܠܰܦܒܶܝܬ̣ ܒ", "nl": "Fonetisch Systeem & Klinkers", "vocab_sec": "2.6", "dial_sec": "2.1", "location": "Mor Gabriel", "category": "cultuur", "cefr": "A1"},
    {"unit": 3, "slug": "slomo", "lat": "Šlomo", "serto": "ܫܠܳܡܐ", "nl": "Hallo & Begroetingen", "vocab_sec": "3.6", "dial_sec": "3.1", "location": "Midyat (Mëḏyaḏ)", "category": "begroetingen", "cefr": "A1"},
    {"unit": 4, "slug": "iqartho", "lat": "Iqarṯo", "serto": "ܐܝܩܰܪܬ݂ܐ", "nl": "Familie", "vocab_sec": "4.5", "dial_sec": "4.1", "location": "Midyat (Mëḏyaḏ)", "category": "familie", "cefr": "A1"},
    {"unit": 5, "slug": "madrasto", "lat": "Madrašto", "serto": "ܡܰܕܪܰܫܬܐ", "nl": "School", "vocab_sec": "5.6", "dial_sec": "5.1", "location": "Mor Gabriel", "category": "cultuur", "cefr": "A1"},
    {"unit": 6, "slug": "bayto", "lat": "Bayto", "serto": "ܒܰܝܬܐ", "nl": "Het Huis", "vocab_sec": "6.5", "dial_sec": "6.1", "location": "Mardin (Marde)", "category": "familie", "cefr": "A1"},
    {"unit": 7, "slug": "suqo", "lat": "Šuqo", "serto": "ܫܘܩܐ", "nl": "Boodschappen & Markt", "vocab_sec": "7.5", "dial_sec": "7.1", "location": "Midyat (Mëḏyaḏ)", "category": "alledaags", "cefr": "A1"},
    {"unit": 8, "slug": "zabno", "lat": "Zabno", "serto": "ܙܰܒܢܐ", "nl": "Tijd & De Klok", "vocab_sec": "8.7", "dial_sec": "8.1", "location": "Ḥaḥ (Anıtlı)", "category": "alledaags", "cefr": "A1"},
    {"unit": 9, "slug": "surgodo", "lat": "Surgodo", "serto": "ܣܘܪܓܳܕ݂ܐ", "nl": "Kalender & Seizoenen", "vocab_sec": "9.5", "dial_sec": "9.1", "location": "Tur Abdin", "category": "alledaags", "cefr": "A2"},
    {"unit": 10, "slug": "muklo", "lat": "Muklo", "serto": "ܡܘܟܠܐ", "nl": "Voedsel & Gastvrijheid", "vocab_sec": "10.5", "dial_sec": "10.1", "location": "Azax (İdil)", "category": "alledaags", "cefr": "A2"},
    {"unit": 11, "slug": "jule-w-gawne", "lat": "Jule w Gawne", "serto": "ܔܘܠܶܐ ܘ ܓܰܘܢܶܐ", "nl": "Kleding en Kleuren", "vocab_sec": "11.5", "dial_sec": "11.1", "location": "Mardin (Marde)", "category": "alledaags", "cefr": "A2"},
    {"unit": 12, "slug": "mazracto", "lat": "Mazracto", "serto": "ܡܰܙܪܰܥܬܐ", "nl": "Boerderij & Dorpsleven", "vocab_sec": "12.5", "dial_sec": "12.1", "location": "Kfarze", "category": "cultuur", "cefr": "A2"},
    {"unit": 13, "slug": "cedo-zcuro", "lat": "ʻEḏo zʻuro", "serto": "ܥܶܕ݂ܐ ܙܥܘܪܐ", "nl": "Kerstmis & Feestdagen", "vocab_sec": "13.6", "dial_sec": "13.1", "location": "Qamišlo / Diaspora", "category": "kerkelijk", "cefr": "A2"},
    {"unit": 14, "slug": "su-taxtor", "lat": "Su taxtor", "serto": "ܣܘ ܬܰܟ݂ܬܳܪ", "nl": "Bij de Dokter & Lichaam", "vocab_sec": "14.6", "dial_sec": "14.1", "location": "Midyat (Mëḏyaḏ)", "category": "alledaags", "cefr": "A2"},
    {"unit": 15, "slug": "spor", "lat": "Spor", "serto": "ܣܦ݁ܳܪ", "nl": "Sport & Vrije Tijd", "vocab_sec": "15.6", "dial_sec": "15.1", "location": "Diaspora", "category": "alledaags", "cefr": "A2"},
    {"unit": 16, "slug": "tlobo-w-gworo", "lat": "Ṭlobo w Gworo", "serto": "ܛܠܳܒܐ ܘܓܘܳܪܐ", "nl": "Liefde en Huwelijk", "vocab_sec": "16.6", "dial_sec": "16.1", "location": "Mor Gabriel", "category": "cultuur", "cefr": "B1"},
]

SYRIAC_CHAR_REGEX = re.compile(r"[\u0700-\u074F]")


class SlomoSuraytScraper:
    """
    Scrapet de echte lessen, 'Luḥo d mele' woordenlijsten, dialogen en 'Kunoš mele'
    rechtstreeks van https://textbook.surayt.com.
    """

    def __init__(self, base_url: str = "https://textbook.surayt.com"):
        self.base_url = base_url.rstrip("/")
        self.normalizer = SuraytUnicodeNormalizer()

    @staticmethod
    def make_word_id(unit_num: int, surayt_lat: str) -> str:
        clean_slug = re.sub(r"[^a-z0-9]", "", surayt_lat.lower())[:12]
        short_hash = hashlib.md5(surayt_lat.strip().lower().encode("utf-8")).hexdigest()[:6]
        return f"w_u{unit_num:02d}_{clean_slug}_{short_hash}"

    @staticmethod
    def make_sentence_id(unit_num: int, surayt_lat: str) -> str:
        short_hash = hashlib.md5(surayt_lat.strip().lower().encode("utf-8")).hexdigest()[:10]
        return f"s_u{unit_num:02d}_{short_hash}"

    async def scrape_full_course(self, max_units: Optional[int] = None) -> Dict[str, List[Dict[str, Any]]]:
        """
        Crawlt de inhoudsopgave van textbook.surayt.com en scrapet alle lessen,
        woordenlijsten (NL/EN/DE) en dialogen.
        """
        lessons: List[Dict[str, Any]] = []
        words_by_id: Dict[str, Dict[str, Any]] = {}
        sentences_by_id: Dict[str, Dict[str, Any]] = {}

        units_to_scrape = SLOMO_SURAYT_UNITS[:max_units] if max_units else SLOMO_SURAYT_UNITS

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},  # Belangrijk: site vereist > 450px breedte!
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            )
            page = await context.new_page()

            # Stap 1: Haal de exacte URL-map op uit de Table of Contents voor NL, EN en DE
            toc_nl = await self._discover_section_urls(page, "nl")
            toc_en = await self._discover_section_urls(page, "en")
            toc_de = await self._discover_section_urls(page, "de")

            for unit_meta in units_to_scrape:
                unit_num = unit_meta["unit"]
                lesson_id = f"lesson_{unit_num:02d}_{unit_meta['slug']}"

                lessons.append({
                    "id": lesson_id,
                    "slug": unit_meta["slug"],
                    "title_nl": f"Les {unit_num}: {unit_meta['nl']}",
                    "title_surayt_lat": self.normalizer.normalize_latin(unit_meta["lat"]),
                    "title_surayt_serto": self.normalizer.normalize_serto(unit_meta["serto"])[0],
                    "location_theme": unit_meta["location"],
                    "cefr_level": unit_meta["cefr"],
                    "order_index": unit_num,
                    "description_nl": f"Šlomo Surayt Hoofdstuk {unit_num} ({unit_meta['lat']}) — Woordenschat, Serto & Dialogen.",
                })

                # Stap 2: Scrape de Woordenschat-pagina ('Luḥo d mele') van dit hoofdstuk
                vocab_sec = unit_meta["vocab_sec"]
                nl_vocab_url = toc_nl.get(vocab_sec) or f"{self.base_url}/nl/Level%20A/{vocab_sec}"
                en_vocab_url = toc_en.get(vocab_sec) or f"{self.base_url}/en/Level%20A/{vocab_sec}"
                de_vocab_url = toc_de.get(vocab_sec) or f"{self.base_url}/de/Level%20A/{vocab_sec}"

                logger.info(f"Scrapen van Les {unit_num} Woordenschat ({vocab_sec}): {nl_vocab_url}")
                nl_rows = await self._scrape_luho_d_mele_page(page, nl_vocab_url)
                en_map = await self._scrape_translation_map(page, en_vocab_url)
                de_map = await self._scrape_translation_map(page, de_vocab_url)

                for row in nl_rows:
                    lat_key = row["surayt_lat"].lower()
                    word_id = self.make_word_id(unit_num, row["surayt_lat"])
                    words_by_id[word_id] = {
                        "id": word_id,
                        "lesson_id": lesson_id,
                        "surayt_lat": row["surayt_lat"],
                        "surayt_serto": row["surayt_serto"],
                        "surayt_serto_unvocalized": row["surayt_serto_unvocalized"],
                        "root_radicals": row.get("root_radicals"),
                        "part_of_speech": row.get("part_of_speech", "noun"),
                        "gender": row.get("gender"),
                        "plural_lat": row.get("plural_lat"),
                        "plural_serto": row.get("plural_serto"),
                        "translations": {
                            "nl": row["translation"],
                            "en": en_map.get(lat_key, ""),
                            "de": de_map.get(lat_key, ""),
                        },
                        "conjugations": [],
                        "audio_url": row.get("audio_url"),
                        "audio_local": f"audio/words/{word_id}.mp3" if row.get("audio_url") else None,
                        "cefr_level": unit_meta["cefr"],
                        "category": unit_meta["category"],
                    }

                # Stap 3: Scrape de Dialoog-pagina (bijv. 3.1, 4.1) van dit hoofdstuk
                dial_sec = unit_meta["dial_sec"]
                nl_dial_url = toc_nl.get(dial_sec) or f"{self.base_url}/nl/Level%20A/{dial_sec}"
                logger.info(f"Scrapen van Les {unit_num} Dialoog ({dial_sec}): {nl_dial_url}")
                dialogue_sents = await self._scrape_dialogue_page(
                    page, nl_dial_url, unit_num, lesson_id, unit_meta["cefr"], unit_meta["category"]
                )
                for sent in dialogue_sents:
                    sentences_by_id[sent["id"]] = sent

            await browser.close()

        return {
            "lessons": lessons,
            "words": list(words_by_id.values()),
            "sentences": list(sentences_by_id.values()),
        }

    async def _discover_section_urls(self, page: Page, lang: str) -> Dict[str, str]:
        """
        Leest de sidebar op /<lang>/Level%20A/0 uit om de exacte URL's inclusief
        '?content-fragment-id=...' per sectienummer (bijv. '3.6', '14.6') te vinden.
        """
        section_map: Dict[str, str] = {}
        toc_url = f"{self.base_url}/{lang}/Level%20A/0"
        try:
            await page.goto(toc_url, wait_until="domcontentloaded", timeout=25000)
            html = await page.content()
            soup = BeautifulSoup(html, "lxml")

            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"]
                text = a_tag.get_text(" ", strip=True)
                # Zoek patronen zoals '3.6', '14.6', '1.1.6' in href of link-tekst
                match = re.search(r"/Level%20A/(\d+(?:\.\d+)?)", href) or re.search(
                    r"^(\d+\.\d+)\b", text
                )
                if match:
                    sec_num = match.group(1)
                    section_map[sec_num] = urljoin(self.base_url, href)
        except Exception as exc:
            logger.warning(f"Kon TOC voor taal '{lang}' niet ophalen ({exc}), gebruik fallback URLs.")
        return section_map

    async def _scrape_luho_d_mele_page(self, page: Page, url: str) -> List[Dict[str, Any]]:
        """
        Scrapet een 'Luḥo d mele' (Woordenschat) tabel op textbook.surayt.com.
        Elke rij bevat: [Surayt Latijn (+ meervoud) | Vertaling | Surayt Serto].
        """
        extracted: List[Dict[str, Any]] = []
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            soup = BeautifulSoup(await page.content(), "lxml")

            for tr in soup.select("table tr"):
                cells = tr.find_all(["td", "th"])
                if len(cells) < 3:
                    continue

                raw_left = cells[0].get_text(" ", strip=True)
                raw_mid = cells[1].get_text(" ", strip=True)
                raw_right = cells[2].get_text(" ", strip=True)

                # Controleer of de rechterkolom daadwerkelijk Syrisch (Serto) schrift bevat
                if not SYRIAC_CHAR_REGEX.search(raw_right):
                    continue

                # Splits eventuele meervoudsvormen zoals 'abro, pl. abne'
                lemma_lat, plural_lat = self._split_lemma_and_plural(raw_left)
                serto_main, plural_serto = self._split_serto_and_plural(raw_right)

                surayt_lat = self.normalizer.normalize_latin(lemma_lat)
                serto_voc, serto_unvoc = self.normalizer.normalize_serto(serto_main)
                audio_url = self._find_audio_in_row(tr)

                if surayt_lat and serto_voc:
                    extracted.append({
                        "surayt_lat": surayt_lat,
                        "plural_lat": self.normalizer.normalize_latin(plural_lat) if plural_lat else None,
                        "surayt_serto": serto_voc,
                        "surayt_serto_unvocalized": serto_unvoc,
                        "plural_serto": self.normalizer.normalize_serto(plural_serto)[0] if plural_serto else None,
                        "translation": raw_mid,
                        "audio_url": audio_url,
                    })
        except Exception as exc:
            logger.warning(f"Kon vocab pagina {url} niet parsen: {exc}")

        return extracted

    async def _scrape_translation_map(self, page: Page, url: str) -> Dict[str, str]:
        """Haalt voor EN of DE de vertaling op gekoppeld aan het Latijnse Surayt-lemma."""
        rows = await self._scrape_luho_d_mele_page(page, url)
        return {r["surayt_lat"].lower(): r["translation"] for r in rows}

    async def _scrape_dialogue_page(
        self,
        page: Page,
        url: str,
        unit_num: int,
        lesson_id: str,
        cefr: str,
        category: str,
    ) -> List[Dict[str, Any]]:
        """Scrapet de 2-koloms dialoogtabellen (Latijns Surayt links, Serto rechts) van een les."""
        sentences: List[Dict[str, Any]] = []
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            soup = BeautifulSoup(await page.content(), "lxml")

            for tr in soup.select("table tr"):
                cells = tr.find_all("td")
                if len(cells) < 2:
                    continue

                left_text = cells[0].get_text(" ", strip=True)
                right_text = cells[-1].get_text(" ", strip=True)

                if not left_text or not SYRIAC_CHAR_REGEX.search(right_text):
                    continue

                surayt_lat = self.normalizer.normalize_latin(left_text)
                serto_voc, serto_unvoc = self.normalizer.normalize_serto(right_text)
                sent_id = self.make_sentence_id(unit_num, surayt_lat)
                audio_url = self._find_audio_in_row(tr)

                tokens = [
                    self.normalizer.normalize_latin(t)
                    for t in re.split(r"[\s,.?!:;]+", surayt_lat)
                    if t.strip()
                ]

                sentences.append({
                    "id": sent_id,
                    "lesson_id": lesson_id,
                    "surayt_lat": surayt_lat,
                    "surayt_serto": serto_voc,
                    "surayt_serto_unvocalized": serto_unvoc,
                    "translations": {"nl": "", "en": "", "de": ""},
                    "cefr_level": cefr,
                    "category": category,
                    "audio_url": audio_url,
                    "audio_local": f"audio/sentences/{sent_id}.mp3" if audio_url else None,
                    "word_tokens": tokens,
                })
        except Exception as exc:
            logger.warning(f"Kon dialoogpagina {url} niet parsen: {exc}")

        return sentences

    @staticmethod
    def _split_lemma_and_plural(raw_lat: str) -> Tuple[str, Optional[str]]:
        parts = re.split(r",\s*(?:pl\.|Pl\.)\s*", raw_lat, maxsplit=1)
        lemma = re.sub(r"\(L\.\d+\)", "", parts[0]).strip()
        plural = re.sub(r"\(L\.\d+\)", "", parts[1]).strip() if len(parts) > 1 else None
        return lemma, plural

    @staticmethod
    def _split_serto_and_plural(raw_serto: str) -> Tuple[str, Optional[str]]:
        parts = [p.strip() for p in re.split(r"[,،/]", raw_serto) if p.strip()]
        if not parts:
            return raw_serto, None
        return parts[0], (parts[1] if len(parts) > 1 else None)

    def _find_audio_in_row(self, tr: Tag) -> Optional[str]:
        audio_el = tr.select_one("audio source[src], audio[src], a[href$='.mp3'], [data-audio]")
        if not audio_el:
            return None
        raw_src = (
            audio_el.get("src")
            or audio_el.get("href")
            or audio_el.get("data-audio")
        )
        return urljoin(self.base_url, str(raw_src)) if raw_src else None
