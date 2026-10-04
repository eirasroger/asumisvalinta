"""Parsing of address searches."""

from asumisvalinta.api.addresses import AddressQuery, parse


def test_street_number_letter_and_municipality():
    assert parse("Mannerheimintie 40 B, Helsinki") == AddressQuery(
        ("mannerheimintie", "helsinki"), 40
    )


def test_street_without_number():
    assert parse("Pohjoinen Rautatiekatu") == AddressQuery(("pohjoinen", "rautatiekatu"), None)


def test_digits_alone_are_not_an_address():
    assert parse("00100") is None
