"""Check that a probe result is supported by pages read in this run."""

from urllib.parse import urlsplit, urlunsplit
import re


def canonical_url(value: str) -> str:
    url = urlsplit(value)
    return urlunsplit((url.scheme.lower(), url.netloc.lower(), url.path.rstrip("/"), url.query, ""))


def normalized_text(value: str) -> str:
    return " ".join(value.split())


def match_page_excerpt(proposed: str, actual: str) -> str | None:
    """Allow typography/whitespace differences, then copy the actual continuous text."""
    words = proposed.strip().split()
    patterns = []
    for word in words:
        patterns.append("".join("['’‘]" if char in "'’‘" else '["“”]' if char in '"“”' else re.escape(char) for char in word))
    if not patterns:
        return None
    match = re.search(r"\s+".join(patterns), actual)
    return match.group(0) if match else None


def verify_result(result: dict, observations: list[dict]) -> None:
    if not result.get("answer", "").strip() or not result.get("pages"):
        raise ValueError("The agent returned an empty result.")
    for page in result["pages"]:
        observed = [item for item in observations if canonical_url(item["url"]) == canonical_url(page["url"])]
        if not observed:
            raise ValueError(f"Result URL was not observed: {page['url']}")
        excerpt = normalized_text(page["excerpt"])
        if not excerpt or not any(excerpt in normalized_text(item["text"]) for item in observed):
            raise ValueError(f"Result excerpt is not supported by the page: {page['url']}")
        if not any(normalized_text(page["title"]) == normalized_text(item["title"]) for item in observed):
            raise ValueError(f"Result title does not match the browser: {page['url']}")
