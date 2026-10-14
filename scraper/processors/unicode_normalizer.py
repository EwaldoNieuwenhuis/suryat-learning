import re
import unicodedata
from typing import Dict, Tuple

# Syrische Unicode ranges voor klinkerpunten (Zow'e) en diakritische tekens
# U+0730 t/m U+073F zijn Syrische klinkers (Ptoho, Zqofo, Rboso, Hboso, 'Soso)
SYRIAC_VOWEL_RANGE = re.compile(r"[\u0730-\u073F]")

# Quššoyo (hard), Rukkoxo (zacht), Majliyana, Marhetana, etc. (U+0740 - U+074A)
SYRIAC_DIACRITICS_RANGE = re.compile(r"[\u0740-\u074A]")

# Onzichtbare richting-markers die HarfBuzz letterverbindingen kunnen breken
DIRECTIONAL_ARTIFACTS = re.compile(r"[\u200E\u200F\u202A-\u202E\u2066-\u2069]")

# Mapping van legacy/decomposed combinaties naar canonieke Šlomo Surayt orthografie
LATIN_SURAYT_REPLACEMENTS: Dict[str, str] = {
    "s\u030c": "š",
    "S\u030c": "Š",
    "c\u030c": "č",
    "C\u030c": "Č",
    "g\u0307": "ġ",
    "G\u0307": "Ġ",
    "h\u0323": "ḥ",
    "H\u0323": "Ḥ",
    "t\u0323": "ṭ",
    "T\u0323": "Ṭ",
    "s\u0323": "ṣ",
    "S\u0323": "Ṣ",
    "d\u0331": "ḏ",
    "D\u0331": "Ḏ",
    "t\u0331": "ṯ",
    "T\u0331": "Ṯ",
    "z\u030c": "ž",
    "Z\u030c": "Ž",
    "ʕ": "ʻ",      # Standaardiseer Ayin naar modifier letter turned comma (U+02BB)
    "ʿ": "ʻ",
    "’": "'",
}

# Mapping van Oost-Syrische/algemene klinkers naar authentieke West-Syrische (Serto/Greek) Zow'e
EAST_TO_WEST_ZOWE: Dict[str, str] = {
    "\u0732": "\u0730",  # Pthaha dotted -> Ptoho above (ܰ)
    "\u0735": "\u0733",  # Zqapha dotted -> Zqofo above (ܳ)
    "\u0738": "\u0736",  # Rbasa dotted  -> Rboso above (ܶ)
    "\u073C": "\u0739",  # Hbasa-Esasa   -> Hboso above (ܺ)
    "\u073F": "\u073C",  # Rwaha         -> 'Soso above (ܽ)
}


class SuraytUnicodeNormalizer:
    """Normaliseert zowel Latijnse Surayt-transcripties als West-Syrisch (Serto) schrift."""

    @staticmethod
    def normalize_latin(text: str) -> str:
        if not text:
            return ""
        # Stap 1: NFD om samengestelde tekens te inspecteren, daarna custom mapping
        decomposed = unicodedata.normalize("NFD", text.strip())
        for old, new in LATIN_SURAYT_REPLACEMENTS.items():
            decomposed = decomposed.replace(old, new)

        # Stap 2: Terug naar NFC voor compacte opslag en exacte weergave in Noto Sans
        normalized = unicodedata.normalize("NFC", decomposed)
        # Verwijder dubbele spaties
        return re.sub(r"\s+", " ", normalized)

    @staticmethod
    def normalize_serto(text: str) -> Tuple[str, str]:
        """
        Retourneert een tuple van:
        1. Volledig gevocaliseerd Serto (met Zow'e en Rukkoxo/Quššoyo)
        2. Ongevocaliseerd Serto (alleen consonanten en Seyome meervoudspunten)
        """
        if not text:
            return "", ""

        # Verwijder verborgen bidi-control karakters
        cleaned = DIRECTIONAL_ARTIFACTS.sub("", text.strip())
        cleaned = unicodedata.normalize("NFC", cleaned)

        # Converteer eventuele Oost-Syrische klinkers naar West-Syrische Zow'e
        for east_vowel, west_vowel in EAST_TO_WEST_ZOWE.items():
            cleaned = cleaned.replace(east_vowel, west_vowel)

        # Herorden combining marks per basisletter zodat HarfBuzz op Android geen dotted circles toont:
        # Volgorde: Basisletter -> Seyome (\u0308) -> Quššoyo/Rukkoxo (\u0741/\u0742) -> Zow'e (\u0730-\u073F)
        vocalized = SuraytUnicodeNormalizer._reorder_syriac_marks(cleaned)

        # Genereer de ongevocaliseerde versie door alleen klinkers (Zow'e) te verwijderen
        # Seyome (\u0308) en Rukkoxo/Quššoyo blijven behouden voor grammaticale precisie
        unvocalized = SYRIAC_VOWEL_RANGE.sub("", vocalized)

        return vocalized, unvocalized

    @staticmethod
    def _reorder_syriac_marks(text: str) -> str:
        result = []
        cluster_marks = []

        def flush_marks():
            if not cluster_marks:
                return
            # Sorteer prioriteit: Seyome (1) -> Diakritisch/Rukkoxo (2) -> Klinkers/Zow'e (3) -> Overig (4)
            def mark_priority(char: str) -> int:
                code = ord(char)
                if code == 0x0308:
                    return 1
                if 0x0740 <= code <= 0x074A:
                    return 2
                if 0x0730 <= code <= 0x073F:
                    return 3
                return 4

            cluster_marks.sort(key=mark_priority)
            result.extend(cluster_marks)
            cluster_marks.clear()

        for char in text:
            if unicodedata.category(char).startswith("M"):
                cluster_marks.append(char)
            else:
                flush_marks()
                result.append(char)
        flush_marks()
        return "".join(result)

    @staticmethod
    def normalize_root(root_str: str) -> str:
        """Standaardiseert een 3-radicale of 4-radicale wortel naar 'k-ṯ-w' formaat."""
        if not root_str:
            return ""
        clean = SuraytUnicodeNormalizer.normalize_latin(root_str.lower())
        radicals = [r.strip() for r in re.split(r"[-.\s/]+", clean) if r.strip()]
        return "-".join(radicals)
