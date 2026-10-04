"""Every language has the same keys as English, so nothing falls back by accident."""

import pytest

from asumisvalinta import texts

TABLES = [
    texts.GEOGRAPHY_LEVELS,
    texts.PRICE_AGE_SCOPES,
    texts.SOURCES,
    texts.WHAT_IFS,
    texts.ERRORS,
]


@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("language", texts.LANGUAGES)
def test_each_language_has_every_key(table, language):
    assert set(table[language]) == set(table[texts.FALLBACK])


def test_missing_keys_fall_back_to_english():
    table = {"en": {"greeting": "Hello {name}"}, "fi": {}}
    assert texts.text(table, "fi", "greeting", name="Roger") == "Hello Roger"
