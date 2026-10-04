"""User-facing text in each language the app supports.

Each table maps a language to templates for `str.format`. A language may leave keys out:
`text` falls back to English, so adding a language never breaks a page.
"""

from typing import Literal

Language = Literal["fi", "en"]
LANGUAGES: tuple[Language, ...] = ("fi", "en")
FALLBACK: Language = "en"

Table = dict[str, dict[str, str]]


def text(table: Table, language: str, key: str, **values: object) -> str:
    template = table.get(language, {}).get(key) or table[FALLBACK][key]
    return template.format(**values)


GEOGRAPHY_LEVELS: Table = {
    "en": {
        "postal_code": "postal code",
        "price_sub_area": "price sub-area",
        "rent_sub_area": "rent sub-area",
        "municipality": "municipality",
        "municipality_all_rooms": "municipality, all room types",
        "region": "region",
        "country": "whole country",
    },
    "fi": {
        "postal_code": "postinumeroalue",
        "price_sub_area": "hinta-alueen osa-alue",
        "rent_sub_area": "vuokra-alueen osa-alue",
        "municipality": "kunta",
        "municipality_all_rooms": "kunta, kaikki huoneluvut",
        "region": "maakunta",
        "country": "koko maa",
    },
}

PRICE_AGE_SCOPES: Table = {
    "en": {
        "postal_code": "this postal code",
        "price_sub_area": "the postal codes of this price area",
        "municipality": "the postal codes of this municipality",
        "region": "the postal codes of this region",
        "country": "all postal codes in Finland",
    },
    "fi": {
        "postal_code": "tämä postinumeroalue",
        "price_sub_area": "tämän hinta-alueen postinumeroalueet",
        "municipality": "tämän kunnan postinumeroalueet",
        "region": "tämän maakunnan postinumeroalueet",
        "country": "kaikki Suomen postinumeroalueet",
    },
}

SOURCES: Table = {
    "en": {
        "built_before": "before {year}",
        "built_from": "from {year} on",
        "built_between": "from {first} to {last}",
        "all_building_ages": "all building ages",
        "building_year": "buildings from {year}",
        "price_per_m2": "Statistics Finland, {level} level, {period}",
        "price_building_age": (
            "Flats built {built} sold for {ratio:.2f} times the average price per m² of all "
            "flats in the same postal code, {first} to {last}, averaged over {scope} "
            "(Statistics Finland)"
        ),
        "price_building_age_none": "Prices are not split by building age",
        "rent_per_m2_month": "Statistics Finland, non-subsidised, {level} level, {period}",
        "price_growth": "Price index in this area, average growth over {years} years",
        "rent_growth": (
            "Lease clause: inflation {inflation:.1%} a year over {years} years to {year}, "
            "at least {floor:.0%}"
        ),
        "rent_growth_market": "Market rents here, average growth over {years} years",
        "maintenance_charge": "Housing company finances, area {area}, {year}, {age}",
        "maintenance_charge_growth": (
            "Same as right-of-occupancy charges, {first} to {last} (Varke). Housing company "
            "charges in this region grew {growth:.1%} a year over {years} years"
        ),
        "capital_charges": "Housing company capital charges by building age, {year}, {age}",
        "own_repairs": (
            "Renovations owner-occupiers of flats pay themselves, average of {first} to {last}"
        ),
        "mortgage_rate": "ECB, average variable rate on new housing loans in Finland, {month}",
        "mortgage_rate_fixed": (
            "ECB, average variable rate on new housing loans in Finland, {month}, fixed for the "
            "whole loan term"
        ),
        "savings_rate": "ECB, new household deposits up to one year in Finland, {month}",
        "aso_fee": (
            "Assumption: {share:.0%} of the buy price. The Act on right-of-occupancy dwellings "
            "(393/2021, section 9) caps fees at 15% of the building's acquisition cost in "
            "state-subsidised buildings; the buy price stands in for that cost"
        ),
        "aso_charge": (
            "Assumption: {share:.0%} of the market rent here. The Act (section 33) requires "
            "charges below the rent of comparable rental flats"
        ),
        "aso_charge_growth": (
            "Right-of-occupancy charges in Finland, average change {first} to {last} (Varke)"
        ),
        "building_cost_index_growth": (
            "Assumption. The building cost index grew {growth:.1%} a year over {years} years "
            "to {month}"
        ),
        "policy": "Tax and lending rules valid on {date}",
        "assumptions": "Calculator assumptions (editable)",
    },
    "fi": {
        "built_before": "Ennen vuotta {year}",
        "built_from": "Vuodesta {year} alkaen",
        "built_between": "Vuosina {first}–{last}",
        "all_building_ages": "kaikki rakennusvuodet",
        "building_year": "rakennusvuosi {year}",
        "price_per_m2": "Tilastokeskus, taso: {level}, {period}",
        "price_building_age": (
            "{built} rakennettujen asuntojen neliöhinta oli {ratio:.2f}-kertainen saman "
            "postinumeroalueen kaikkien asuntojen keskihintaan verrattuna vuosina "
            "{first}–{last}; keskiarvo: {scope} (Tilastokeskus)"
        ),
        "price_building_age_none": "Hintoja ei ole jaoteltu rakennusvuoden mukaan",
        "rent_per_m2_month": (
            "Tilastokeskus, vapaarahoitteiset vuokra-asunnot, taso: {level}, {period}"
        ),
        "price_growth": "Alueen hintaindeksi, keskimääräinen kasvu {years} vuoden ajalta",
        "rent_growth": (
            "Vuokrasopimuksen indeksiehto: inflaatio {inflation:.1%} vuodessa {years} vuoden "
            "ajalta vuoteen {year} asti, vähintään {floor:.0%}"
        ),
        "rent_growth_market": "Alueen markkinavuokrat, keskimääräinen kasvu {years} vuoden ajalta",
        "maintenance_charge": "Asunto-osakeyhtiöiden talous, alue {area}, {year}, {age}",
        "maintenance_charge_growth": (
            "Sama kuin asumisoikeusasuntojen käyttövastikkeissa vuosina {first}–{last} (Varke). "
            "Asunto-osakeyhtiöiden vastikkeet nousivat tällä alueella {growth:.1%} vuodessa "
            "{years} vuoden aikana"
        ),
        "capital_charges": (
            "Asunto-osakeyhtiöiden pääomavastikkeet rakennusvuoden mukaan, {year}, {age}"
        ),
        "own_repairs": (
            "Omistusasujien itse maksamat korjaukset, keskiarvo vuosilta {first}–{last}"
        ),
        "mortgage_rate": (
            "EKP, uusien asuntolainojen keskimääräinen vaihtuva korko Suomessa, {month}"
        ),
        "mortgage_rate_fixed": (
            "EKP, uusien asuntolainojen keskimääräinen vaihtuva korko Suomessa, {month}, "
            "kiinteänä koko laina-ajan"
        ),
        "savings_rate": "EKP, kotitalouksien uudet enintään vuoden talletukset Suomessa, {month}",
        "aso_fee": (
            "Oletus: {share:.0%} velattomasta hinnasta. Laki asumisoikeusasunnoista (393/2021, "
            "9 §) rajaa valtion tukemissa taloissa asumisoikeusmaksut enintään 15 prosenttiin "
            "talon hankinta-arvosta; velaton hinta kuvaa tätä arvoa"
        ),
        "aso_charge": (
            "Oletus: {share:.0%} alueen markkinavuokrasta. Lain 33 §:n mukaan käyttövastikkeen "
            "on oltava pienempi kuin vastaavien vuokra-asuntojen vuokra"
        ),
        "aso_charge_growth": (
            "Asumisoikeusasuntojen käyttövastikkeiden keskimääräinen muutos Suomessa vuosina "
            "{first}–{last} (Varke)"
        ),
        "building_cost_index_growth": (
            "Oletus. Rakennuskustannusindeksi nousi {growth:.1%} vuodessa {years} vuoden aikana "
            "{month} asti"
        ),
        "policy": "Vero- ja lainasäännöt, voimassa {date}",
        "assumptions": "Laskurin oletukset (muokattavissa)",
    },
}

WHAT_IFS: Table = {
    "en": {
        "rates_down": "Interest rates 1 point lower",
        "rates_up": "Interest rates 1 point higher",
        "prices_slower": "Flat prices grow 2 points slower",
        "prices_faster": "Flat prices grow 2 points faster",
        "rents_slower": "Rents grow 1 point slower",
        "rents_faster": "Rents grow 2 points faster",
        "charges_faster": "Charges rise 2 points faster",
        "savings_lower": "Savings earn 2 points less",
        "savings_higher": "Savings earn 2 points more",
    },
    "fi": {
        "rates_down": "Korot 1 prosenttiyksikön alemmat",
        "rates_up": "Korot 1 prosenttiyksikön korkeammat",
        "prices_slower": "Asuntojen hinnat nousevat 2 prosenttiyksikköä hitaammin",
        "prices_faster": "Asuntojen hinnat nousevat 2 prosenttiyksikköä nopeammin",
        "rents_slower": "Vuokrat nousevat 1 prosenttiyksikön hitaammin",
        "rents_faster": "Vuokrat nousevat 2 prosenttiyksikköä nopeammin",
        "charges_faster": "Vastikkeet nousevat 2 prosenttiyksikköä nopeammin",
        "savings_lower": "Säästöjen tuotto 2 prosenttiyksikköä pienempi",
        "savings_higher": "Säästöjen tuotto 2 prosenttiyksikköä suurempi",
    },
}

ERRORS: Table = {
    "en": {
        "no_data": "No published figures for postal code {postal_code}.",
        "not_configured": "The question service is not configured.",
        "unavailable": "The assistant is not available right now.",
        "wait": "Please wait {seconds} seconds between questions.",
        "budget": "The assistant has reached today's limit. Try again tomorrow.",
        "daily_limit": "The daily question limit is reached. Try again tomorrow.",
        "session_limit": "This session has used all its questions.",
    },
    "fi": {
        "no_data": "Postinumeroalueelle {postal_code} ei ole julkaistuja lukuja.",
        "not_configured": "Kysymyspalvelua ei ole otettu käyttöön.",
        "unavailable": "Avustaja ei ole juuri nyt käytettävissä.",
        "wait": "Odota {seconds} sekuntia kysymysten välillä.",
        "budget": "Avustajan päiväraja on täynnä. Yritä huomenna uudelleen.",
        "daily_limit": "Päivän kysymysraja on täynnä. Yritä huomenna uudelleen.",
        "session_limit": "Tämän istunnon kysymykset on käytetty.",
    },
}
