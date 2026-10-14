import hashlib
import logging
from typing import Any, Dict, List
import httpx
from bs4 import BeautifulSoup
from processors.unicode_normalizer import SuraytUnicodeNormalizer

logger = logging.getLogger(__name__)


class SuraytCorpusScraper:
    """
    Scrapet dialogen, grammaticale voorbeeldzinnen en thematische hoofdstukken
    inclusief gekoppelde audio en CEFR-niveau-indeling.
    """

    def __init__(self, corpus_base_url: str = "https://textbook.surayt.com"):
        self.corpus_base_url = corpus_base_url.rstrip("/")
        self.normalizer = SuraytUnicodeNormalizer()

    @staticmethod
    def generate_sentence_id(surayt_lat: str) -> str:
        return "s_" + hashlib.sha256(surayt_lat.lower().strip().encode("utf-8")).hexdigest()[:14]

    async def scrape_chapters(self, chapter_slugs: List[str]) -> List[Dict[str, Any]]:
        sentences: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            for slug in chapter_slugs:
                try:
                    chapter_sentences = await self._scrape_single_chapter(client, slug)
                    sentences.extend(chapter_sentences)
                except Exception as exc:
                    logger.warning(f"Kon hoofdstuk '{slug}' niet live scrapen: {exc}")
        return sentences

    async def _scrape_single_chapter(
        self, client: httpx.AsyncClient, slug: str
    ) -> List[Dict[str, Any]]:
        url = f"{self.corpus_base_url}/chapter/{slug}"
        response = await client.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")
        cefr_level = soup.select_one("meta[name='cefr']")
        level_str = cefr_level["content"] if cefr_level else "A1"

        extracted: List[Dict[str, Any]] = []
        for row in soup.select(".dialogue-line, .corpus-sentence"):
            raw_lat = row.select_one(".sentence-lat")
            raw_serto = row.select_one(".sentence-serto")
            if not raw_lat or not raw_serto:
                continue

            surayt_lat = self.normalizer.normalize_latin(raw_lat.get_text(strip=True))
            serto_voc, serto_unvoc = self.normalizer.normalize_serto(raw_serto.get_text(strip=True))
            sent_id = self.generate_sentence_id(surayt_lat)

            audio_tag = row.select_one("[data-audio-url]")
            audio_url = audio_tag["data-audio-url"] if audio_tag else None

            extracted.append({
                "id": sent_id,
                "surayt_lat": surayt_lat,
                "surayt_serto": serto_voc,
                "surayt_serto_unvocalized": serto_unvoc,
                "translations": {
                    "nl": self._safe_text(row, ".trans-nl"),
                    "en": self._safe_text(row, ".trans-en"),
                    "de": self._safe_text(row, ".trans-de"),
                },
                "cefr_level": level_str,
                "category": slug,
                "audio_url": audio_url,
                "audio_local": f"audio/sentences/{sent_id}.mp3" if audio_url else None,
                "word_tokens": [
                    self.normalizer.normalize_latin(w)
                    for w in surayt_lat.replace("?", "").replace(".", "").replace(",", "").split()
                ],
            })
        return extracted

    @staticmethod
    def _safe_text(parent: BeautifulSoup, selector: str) -> str:
        el = parent.select_one(selector)
        return el.get_text(strip=True) if el else ""
