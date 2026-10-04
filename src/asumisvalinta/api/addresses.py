"""Find the postal code of a street address with the Posti street ranges."""

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

MAX_RESULTS = 15
MIN_TYPO_LENGTH = 4
TOKEN = re.compile(r"\d+|[^\s\d,]+")


@dataclass(frozen=True)
class AddressQuery:
    """Words of a street name, optionally followed by a municipality, and a building number."""

    words: tuple[str, ...]
    number: int | None


def parse(text: str) -> AddressQuery | None:
    """Split "Mannerheimintie 40 B, Helsinki" into words and the building number.

    Returns None when the text has no word to match a street name with.
    """
    number = None
    words = []
    for token in TOKEN.findall(text.lower()):
        if token.isdigit():
            if number is None:
                number = int(token)
        elif number is not None and len(token) == 1:
            continue
        else:
            words.append(token)
    if not words:
        return None
    return AddressQuery(tuple(words), number)


def _number_text(row: dict[str, Any]) -> str:
    low, high = row["lowest_building_number"], row["highest_building_number"]
    if low is None:
        return ""
    if low == high:
        return str(low)
    return f"{low}\u2013{high}"


def _label(street: str, ranges: list[dict[str, Any]], number: int | None) -> str:
    if number is not None:
        return f"{street} {number}"
    numbers = [text for text in dict.fromkeys(_number_text(row) for row in ranges) if text]
    if not numbers or len(numbers) > 3:
        return street
    return f"{street} {', '.join(numbers)}"


def _typo_limit(word: str) -> int:
    """Letters that may differ from a street name: none for short words, then one, then two."""
    if len(word) < MIN_TYPO_LENGTH:
        return 0
    return 1 if len(word) < 8 else 2


def _distance(column: str) -> str:
    """Edits between the word and the street name, or the start of it as long as the word."""
    return (
        f"least(damerau_levenshtein({column}, strip_accents(?)), "
        f"damerau_levenshtein(left({column}, ?), strip_accents(?)))"
    )


def _sql(query: AddressQuery, with_number: bool, fuzzy: bool) -> tuple[str, list[Any]]:
    name = "strip_accents(lower({}))"
    street_fi = name.format("street_name_fi")
    street_sv = name.format("coalesce(street_name_sv, '')")
    municipality = name.format("municipality_name")
    first, *rest = query.words
    if fuzzy:
        # Typos rarely hit the first letter; matching it keeps the search fast and relevant.
        word = [first, len(first), first]
        distance = f"least({_distance(street_fi)}, {_distance(street_sv)})"
        distance_params: list[Any] = [*word, *word]
        conditions = [
            f"(left({street_fi}, 1) = left(strip_accents(?), 1) "
            f"or left({street_sv}, 1) = left(strip_accents(?), 1))",
            f"{distance} <= ?",
        ]
        params: list[Any] = [first, first, *distance_params, _typo_limit(first)]
        finnish = f"{_distance(street_fi)} <= ?"
        finnish_params: list[Any] = [*word, _typo_limit(first)]
    else:
        distance, distance_params = "0", []
        conditions = [f"({street_fi} like strip_accents(?) or {street_sv} like strip_accents(?))"]
        params = [f"{first}%", f"{first}%"]
        finnish, finnish_params = f"{street_fi} like strip_accents(?)", [f"{first}%"]
    for word_ in rest:
        conditions.append(
            f"({street_fi} like strip_accents(?) or {street_sv} like strip_accents(?) "
            f"or {municipality} like strip_accents(?))"
        )
        params += [f"%{word_}%", f"%{word_}%", f"{word_}%"]
    if with_number:
        conditions.append(
            "? between lowest_building_number and highest_building_number "
            "and building_numbers in ('all', ?)"
        )
        params += [query.number, "odd" if query.number % 2 else "even"]
    sql = (
        "select street_name_fi, street_name_sv, municipality_name, postal_code, postal_area_name, "
        "is_helsinki_metro, building_numbers, lowest_building_number, highest_building_number, "
        f"{finnish} as matches_finnish, {distance} as typo_distance, downloaded_on "
        "from marts.dim_street_address_range where " + " and ".join(conditions)
    )
    return sql, [*finnish_params, *distance_params, *params]


def search(
    text: str, rows: Callable[[str, list[Any]], list[dict[str, Any]]]
) -> list[dict[str, Any]]:
    """Postal code areas of the streets that match the text, Helsinki metropolitan area first.

    With a building number, only the ranges that contain it are returned; when no range
    contains it, every postal code of the matching streets is returned with its ranges.
    Accents are ignored, and when no street name starts with the text, names a typo away
    from it are matched.
    """
    query = parse(text)
    if query is None:
        return []
    found: list[dict[str, Any]] = []
    number = None
    for fuzzy in (False, True):
        if fuzzy and not _typo_limit(query.words[0]):
            break
        if query.number is not None:
            found = rows(*_sql(query, with_number=True, fuzzy=fuzzy))
            number = query.number if found else None
        if not found:
            found = rows(*_sql(query, with_number=False, fuzzy=fuzzy))
        if found:
            break
    if found:
        closest = min(row["typo_distance"] for row in found)
        found = [row for row in found if row["typo_distance"] == closest]

    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in found:
        street = row["street_name_fi"] if row["matches_finnish"] else row["street_name_sv"]
        groups.setdefault((street, row["municipality_name"], row["postal_code"]), []).append(row)
    ordered = sorted(
        groups.items(),
        key=lambda item: (not item[1][0]["is_helsinki_metro"], item[0][1], item[0][0], item[0][2]),
    )
    return [
        {
            "postal_code": postal_code,
            "postal_area_name": ranges[0]["postal_area_name"],
            "municipality_name": municipality,
            "is_helsinki_metro": ranges[0]["is_helsinki_metro"],
            "street": _label(street, ranges, number),
            "addresses_downloaded_on": ranges[0]["downloaded_on"],
        }
        for (street, municipality, postal_code), ranges in ordered[:MAX_RESULTS]
    ]
