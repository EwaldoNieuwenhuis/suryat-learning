import asyncio
import hashlib
import logging
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Page
from processors.unicode_normalizer import SuraytUnicodeNormalizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


class SuraytDictionaryScraper:
    """
    Scrapet Surayt lemma's, Serto-schrift, 3-radicale wortels, vervoegingstabellen
    en meertalige vertalingen (NL, EN, DE) uit online Surayt woordenboekbronnen.
    """

    def __init__(self, base_url: str = "https://dictionary.surayt.com"):
        self.base_url = base_url.rstrip("/")
        self.normalizer = SuraytUnicodeNormalizer()

    @staticmethod
    def generate_deterministic_id(surayt_lat: str, part_of_speech: str) -> str:
        raw = f"{surayt_lat.lower().strip()}::{part_of_speech.lower().strip()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    async def scrape_all_entries(self, search_letters: List[str]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="SuraytLanguagePreservationBot/1.0 (+https://surayt-app.org)"
            )
            page = await context.new_page()

            for letter in search_letters:
                logger.info(f"Scrapen van woordenboek-index voor letter: {letter}")
                try:
                    entries = await self._scrape_letter_page(page, letter)
                    results.extend(entries)
                except Exception as exc:
                    logger.error(f"Fout bij letter '{letter}': {exc}")

            await browser.close()
        return results

    async def _scrape_letter_page(self, page: Page, letter: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/search?q={letter}&lang=nl"
        await page.goto(url, wait_until="networkidle", timeout=30000)
        html = await page.content()
        soup = BeautifulSoup(html, "lxml")

        parsed_items: List[Dict[str, Any]] = []
        lemma_cards = soup.select(".lemma-entry, .dictionary-item")

        for card in lemma_cards:
            raw_lat = self._extract_text(card, ".lemma-latin, .surayt-lat")
            raw_serto = self._extract_text(card, ".lemma-serto, .syriac-text")
            if not raw_lat or not raw_serto:
                continue

            surayt_lat = self.normalizer.normalize_latin(raw_lat)
            serto_voc, serto_unvoc = self.normalizer.normalize_serto(raw_serto)
            pos = self._extract_text(card, ".pos-tag, .part-of-speech") or "noun"
            raw_root = self._extract_text(card, ".root-radicals, .etymology-root")
            root_radicals = self.normalizer.normalize_root(raw_root) if raw_root else None

            translations = {
                "nl": self._extract_text(card, ".trans-nl") or "",
                "en": self._extract_text(card, ".trans-en") or "",
                "de": self._extract_text(card, ".trans-de") or "",
            }

            audio_el = card.select_one("audio source, a.audio-play[data-src]")
            audio_url = None
            if audio_el:
                audio_url = audio_el.get("src") or audio_el.get("data-src")
                if audio_url and audio_url.startswith("/"):
                    audio_url = f"{self.base_url}{audio_url}"

            conjugations = self._parse_conjugation_table(card)
            cefr_level = self._extract_text(card, ".cefr-badge") or "A1"
            category = self._extract_text(card, ".category-tag") or "alledaags"

            item_id = self.generate_deterministic_id(surayt_lat, pos)

            parsed_items.append({
                "id": item_id,
                "surayt_lat": surayt_lat,
                "surayt_serto": serto_voc,
                "surayt_serto_unvocalized": serto_unvoc,
                "root_radicals": root_radicals,
                "part_of_speech": pos.lower(),
                "gender": self._extract_text(card, ".gender-tag"),
                "plural_lat": self.normalizer.normalize_latin(
                    self._extract_text(card, ".plural-lat") or ""
                ) or None,
                "plural_serto": self.normalizer.normalize_serto(
                    self._extract_text(card, ".plural-serto") or ""
                )[0] or None,
                "translations": translations,
                "conjugations": conjugations,
                "audio_url": audio_url,
                "audio_local": f"audio/words/{item_id}.mp3" if audio_url else None,
                "cefr_level": cefr_level.upper(),
                "category": category.lower(),
            })

        return parsed_items

    def _parse_conjugation_table(self, card: BeautifulSoup) -> List[Dict[str, str]]:
        table = card.select_one("table.conjugation-table")
        if not table:
            return []

        conjugations: List[Dict[str, str]] = []
        for row in table.select("tr[data-tense]"):
            tense = row.get("data-tense", "present")
            person = self._extract_text(row, ".conj-person") or "3ms"
            form_lat = self.normalizer.normalize_latin(
                self._extract_text(row, ".conj-lat") or ""
            )
            form_serto, _ = self.normalizer.normalize_serto(
                self._extract_text(row, ".conj-serto") or ""
            )
            if form_lat:
                conjugations.append({
                    "tense": tense,
                    "person": person,
                    "surayt_lat": form_lat,
                    "surayt_serto": form_serto,
                })
        return conjugations

    @staticmethod
    def _extract_text(parent: BeautifulSoup, selector: str) -> Optional[str]:
        el = parent.select_one(selector)
        return el.get_text(strip=True) if el else None
