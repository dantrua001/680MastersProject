"""Dictionary. Uses data/words.txt; downloads the public-domain ENABLE list on first run if it is missing."""
import logging
import urllib.request
from pathlib import Path

log = logging.getLogger("words")
FILE = Path(__file__).parent / "data" / "words.txt"
MIN_BYTES = 100_000
URLS = (
    "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt",
    "https://raw.githubusercontent.com/jesstess/Scrabble/master/scrabble/sowpods.txt",
)
_words = None  # None means "no dictionary loaded": any alphabetic word is accepted


def set_words(items):
    global _words
    _words = None if items is None else {w.upper() for w in items}


def _download():
    for url in URLS:
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                data = resp.read()
            if len(data) > MIN_BYTES:
                FILE.parent.mkdir(parents=True, exist_ok=True)
                FILE.write_bytes(data)
                return
        except Exception as exc:  # network problems shouldn't stop the server
            log.warning("Could not download word list from %s: %s", url, exc)


def load():
    global _words
    if not FILE.exists() or FILE.stat().st_size < MIN_BYTES:
        _download()
    if FILE.exists() and FILE.stat().st_size >= MIN_BYTES:
        _words = {w.upper() for w in FILE.read_text().split() if w.isalpha()}
        log.info("Loaded %d words.", len(_words))
    else:
        _words = None
        log.warning("No word list found: ANY alphabetic word will be accepted. Put one word per line in %s", FILE)


def is_valid(word: str) -> bool:
    w = word.upper()
    if _words is None:
        return len(w) >= 2 and w.isalpha()
    return w in _words


def status() -> dict:
    return {"dictionary_loaded": _words is not None, "word_count": len(_words or ())}
