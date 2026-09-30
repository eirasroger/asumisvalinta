import pytest

from asumisvalinta.scenario.defaults import AgeClass, capital_charge_schedule

# Capital charges by construction period in the statistics year 2025, €/m² a month.
CLASSES = [
    AgeClass(None, 1959, 5.0, 2.0),
    AgeClass(1960, 1969, 5.0, 3.0),
    AgeClass(1970, 1979, 5.0, 1.5),
    AgeClass(1980, 1989, 5.0, 1.0),
    AgeClass(1990, 1999, 5.0, 0.6),
    AgeClass(2000, 2009, 5.0, 0.5),
    AgeClass(2010, None, 5.0, 7.0),
]


def test_a_building_pays_what_buildings_of_its_age_pay_today():
    # Built 1985, bought in 2026: age 41 in 2026 is like a 1984 building in 2025 (1.0);
    # age 50 in 2035 is like a 1975 building (1.5); age 60 in 2045 like 1965 (3.0).
    schedule = capital_charge_schedule(CLASSES, 2025, 2026, 1985)
    assert schedule[0] == 1.0
    assert schedule[9] == 1.5
    assert schedule[19] == 3.0


def test_new_buildings_get_the_2000s_level():
    # The 2010s level mostly repays construction loans, so a building from 2020 pays the
    # 2000s level until it is as old as the 2000s buildings are today.
    schedule = capital_charge_schedule(CLASSES, 2025, 2026, 2020)
    assert schedule[0] == 0.5
    # Age 35 in 2055 is like a 1990 building in 2025.
    assert schedule[29] == 0.6


def test_unknown_building_year_averages_the_renovation_periods():
    schedule = capital_charge_schedule(CLASSES, 2025, 2026, None)
    assert schedule == (pytest.approx((2.0 + 3.0 + 1.5 + 1.0 + 0.6 + 0.5) / 6),)
