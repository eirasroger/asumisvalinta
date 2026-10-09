# Menetelmät

Tällä sivulla kerrotaan, miten laskuri vertaa kolmea tapaa asua asunnossa tietyn vuosimäärän ajan: vuokra-asuntoa, asumisoikeusasuntoa (ASO) ja omistusasuntoa asunto-osakeyhtiössä. Sivulla on jokainen kaava, tietolähde ja yksinkertaistus. Laskuri antaa vertailuun tarkoitettuja arvioita. Se ei ole taloudellista neuvontaa.

## Vertailu lyhyesti

Jokainen vaihtoehto aloittaa samalla rahamäärällä ja käyttää kuukaudessa saman verran rahaa. Kuukauden budjetin määrää vaihtoehto, jonka asumiskulut ovat sinä kuukautena suurimmat. Muut vaihtoehdot säästävät erotuksen joko säästötilille tai indeksirahastoihin käyttäjän valinnan mukaan. Tarkastelujakson lopussa kaikki muutetaan rahaksi: asunto myydään, asumisoikeusmaksu palautetaan, säästöt nostetaan ja verot maksetaan. Vaihtoehto, jolle jää eniten rahaa, on valituilla oletuksilla edullisin tapa asua kyseisen jakson ajan.

```steps
Sama alku | Jokainen vaihtoehto aloittaa samalla pääomalla.
Sama budjetti | Kuukauden kallein vaihtoehto määrää budjetin.
Erotus säästöön | Edullisemmat vaihtoehdot säästävät sen, mitä ne eivät käytä.
Rahaksi | Lopussa asunto myydään, maksu palautetaan ja verot maksetaan.
```

## Merkinnät

| Merkki | Merkitys |
|---|---|
| A | Asunnon pinta-ala, m² |
| T | Tarkastelujakso kuukausina (käyttäjä valitsee kokonaisia vuosia) |
| t | Kuukausi, alkaen nollasta |
| y | Kuukauden t vuosi, y = floor(t / 12) |
| P₀ | Velaton neliöhinta tänään |
| g_P | Hintojen vuosikasvu |
| R₀ | Kuukausivuokra neliöltä tänään |
| g_R | Vuokrien vuosikasvu |
| M₀ | Hoitovastike neliöltä kuukaudessa tänään |
| C_y | Rahoitusvastike neliöltä kuukaudessa vuonna y, tämän päivän euroina |
| W | Asunnon sisäiset korjaukset neliöltä vuodessa tänään |
| g_M | Taloyhtiön vastikkeiden vuosikasvu |
| F | Asumisoikeusmaksu neliöltä |
| K₀ | Käyttövastike neliöltä kuukaudessa tänään |
| g_K | Käyttövastikkeen vuosikasvu |
| g_I | Rakennuskustannusindeksin vuosikasvu |
| r | Vuotuinen korko tai säästöjen odotettu tuotto |

Kaikki summat ovat nimellisiä euroja. Kasvuluvut ovat vuotuisia.

## Huonelukuryhmät

Suomalaisissa asuntoilmoituksissa keittiötä ei lasketa huoneeksi. Tilastokeskus julkaisee hinnat ja vuokrat vain kolmelle ryhmälle: yksiöille, kaksioille sekä kolmioille ja sitä suuremmille asunnoille. Siksi laskurissa on nämä kolme ryhmää.

## Alkupääoma

Ostaja maksaa omarahoitusosuuden ja varainsiirtoveron asunnon kaupan yhteydessä:

```formula
Velaton hinta | V₀ = P₀ × A
Omarahoitusosuus | D = d × V₀
Varainsiirtovero | τ × V₀
Ostajan maksu alussa | U_buy = D + τ × V₀
Asumisoikeusmaksu | U_aso = F × A
Alkupääoma | C₀ = max(U_buy, U_aso)
```

Tässä d on omarahoituksen osuus ja τ varainsiirtoveron osuus velattomasta hinnasta. Jokainen vaihtoehto aloittaa samalla pääomalla C₀. Se osa, jota vaihtoehto ei maksa alussa, siirtyy sen säästöihin kuukautena 0. Vuokralainen säästää koko pääoman C₀.

## Kuukausittaiset asumiskulut

Kasvavat kulut nousevat kerran vuodessa, kunkin vuoden alussa:

```formula
Vuokra | R₀ × (1 + g_R)^y × A
Asumisoikeus | K₀ × (1 + g_K)^y × A
Omistus | asuntolainan erä + yhtiölainan erä + (M₀ + C_y + W / 12) × (1 + g_M)^y × A − ASP-korkotuki
```

Kuukauden budjetti on näistä kuluista suurin. Kukin vaihtoehto säästää kuukauden lopussa budjetin ja omien kulujensa erotuksen.

### Rahoitusvastike seuraa rakennuksen ikää

Taloyhtiöt perivät osakkailta maksuja esimerkiksi putki-, julkisivu- ja kattoremonteista. Tilastokeskus julkaisee nämä pääomavastikkeet neliötä kohden rakennusvuosittain. Rakennus, joka täyttää vuonna y a vuotta, maksaa saman kuin a-vuotiaat rakennukset maksavat viimeisimpänä tilastovuonna: vuonna 1985 valmistunut ja vuonna 2026 ostettu talo maksaa nyt 1980-luvun alun talojen tason ja kahdenkymmenen vuoden päästä, kun putket ovat vuorossa, nykyisten 1960-luvun talojen tason. Vuodesta 2010 alkaen valmistuneet talot maksavat näillä vastikkeilla pääosin rakennuslainaansa, jonka yhtiölainaosuus jo kattaa, joten nuoremmat talot maksavat 2000-luvun talojen tason. Ilman rakennusvuotta laskuri käyttää ennen vuotta 2010 valmistuneiden talojen keskiarvoa.

Rakennusvuosi skaalaa myös hoitovastiketta: alueen vastike kerrotaan rakennuksen valmistumiskauden vastikkeen suhteella kaikkien rakennusten vastikkeeseen.

### Asunnon sisäiset korjaukset

Omistajat maksavat myös oman asuntonsa korjaukset, kuten keittiön, kylpyhuoneen tai lattiat. Oletusarvo W on keskiarvo siitä, mitä kerrostaloasuntojen omistusasujat maksoivat teetetyistä korjauksista neliötä kohden viimeisten viiden vuoden aikana. Vuokralaiset ja asumisoikeusasukkaat eivät maksa näitä.

### Pois jätetyt kulut

Kulut, jotka eivät riipu valinnasta, kuten sähkö, asukaskohtainen vesimaksu ja kotivakuutus, ovat samat kaikissa kolmessa vaihtoehdossa, joten ne on jätetty pois.

## Lainat

Asuntolaina on osakkeista maksettu hinta vähennettynä omarahoitusosuudella: L = V₀ − S − D, missä S on asunnon osuus taloyhtiön lainasta.

Kuukausikorko on vuosikorko jaettuna kahdellatoista. Korko seuraa polkua: se pysyy ennallaan, nousee tai laskee kiinteän verran vuodessa (laskeva polku pysähtyy 0 prosenttiin). Vuoden korko koskee kaikkia sen kuukausia. Kiinteäkorkoinen laina pitää korkonsa kiinteän jakson ajan ja seuraa sen jälkeen polkua.

Lyhennystapoja on kaksi:

- Annuiteettilaina: erä maksaa lainan takaisin jäljellä olevassa laina-ajassa, B × i / (1 − (1 + i)^(−n)), missä B on lainan saldo, i kuukausikorko ja n jäljellä olevien kuukausien määrä. Erä lasketaan uudelleen aina, kun korko muuttuu, joten laina-aika pysyy samana.
- Tasalyhenteinen laina: joka kuukausi lyhennetään sama määrä, L / (laina-aika kuukausina), ja lisäksi maksetaan korko saldolle.

Yhtiölainaosuus S maksetaan annuiteettina omalla laina-ajallaan saman korkopolun mukaan.

### ASP-laina

Ensiasunnon ostaja, joka on säästänyt ASP-tilille vähintään 10 prosenttia hinnasta, voi saada ASP-lainan. Ensimmäisten kymmenen lainavuoden ajan valtio maksaa 70 prosenttia 3,8 prosenttia ylittävästä korosta lainan ASP-osuudelle. ASP-osuus on yhdellä henkilöllä enintään 230 000 € Helsingissä, Espoossa, Vantaalla, Kauniaisissa, Tampereella, Turussa ja Oulussa ja muualla 160 000 €. Korkotuki kuukaudessa on 0,7 × max(0, korko − 3,8 %) / 12 × saldo × min(1, enimmäismäärä / L). Ensiasunnon ostajan vapautus varainsiirtoverosta päättyi 1.1.2024, joten ensiasunnosta maksetaan sama varainsiirtovero kuin muistakin asunnoista.

## Säästöt

Säästöt kasvavat kuukausittain, missä i on valitun säästötavan kuukausituotto:

```formula
Säästöt | säästöt(t + 1) = säästöt(t) × (1 + i) + talletus(t)
```

- **Säästötili.** Pankki pidättää talletusten koroista 30 prosentin lähdeveron korkoa maksaessaan, ja vero on lopullinen. Saldo kasvaa siis verojen jälkeisellä korolla: i = (1 + r × 0,7)^(1/12) − 1. Lopussa ei makseta mitään.
- **Indeksirahastot.** Tuotto kasvaa ennen veroja: i = (1 + r)^(1/12) − 1. Voitosta maksetaan vero, kun osuudet myydään tarkastelujakson lopussa.
- **Ei sijoiteta.** Raha säilytetään käteisenä: ei korkoa eikä veroa.

Molemmat tuotot syötetään ennen veroja.

## Tarkastelujakson loppu

**Omistus.** Asunnon arvo on V_T = V₀ × (1 + g_P)^(T / 12). Myyntikulut ovat s × V_T. Jäljellä oleva asuntolaina ja yhtiölainaosuus maksetaan pois. Varallisuus on V_T − s × V_T − jäljellä olevat lainat + säästöt − vero.

**Asumisoikeus.** Maksu palautetaan rakennuskustannusindeksillä korotettuna eikä koskaan maksettua pienempänä: palautus = F × A × max(1, (1 + g_I)^(T / 12)) (laki 393/2021, 56 §). Laki korottaa maksua siitä päivästä, jolloin asunnon ensimmäinen maksu suoritettiin. Olemassa olevan asumisoikeuden hinta on ensimmäinen maksu tähän päivään korotettuna, joten tämän päivän ja ensimmäisen maksun ajankohdan indeksointi antavat saman palautuksen. Palautus seuraa rakennuskustannuksia, ei asuntojen hintoja. Varallisuus on palautus + säästöt − vero.

**Vuokra.** Varallisuus on säästöt − vero.

## Verot

- **Pääomatulovero.** Pääomatuloja verotetaan tasaisesti 30 prosentin mukaan. Yli 30 000 euron vuotuisten pääomatulojen 34 prosentin vero on jätetty pois.
- **Talletusten korot.** Lähdevero joka vuosi, kuten yllä.
- **Rahasto-osuudet.** Verotettava voitto on pienempi seuraavista: (myyntihinta − sijoitettu raha) ja (myyntihinta × (1 − olettamaprosentti)). Hankintameno-olettama on 20 prosenttia myyntihinnasta tai kymmenen vuoden jälkeen 40 prosenttia.
- **Asunnon myynti.** Myynti on verovapaa, kun asunto on omistettu ja siinä on asuttu vähintään kaksi vuotta. Muuten verotettava voitto on pienempi seuraavista: (myyntihinta − ostohinta − varainsiirtovero − myyntikulut) ja (myyntihinta × (1 − olettamaprosentti)), samoilla olettamaprosenteilla.
- **Asumisoikeus.** Asumisoikeudesta luopumista verotetaan kuten oman asunnon myyntiä: indeksikorotus on kahden vuoden jälkeen verovapaa.
- **Asuntolainan korot** eivät ole vähennyskelpoisia omassa käytössä olevassa asunnossa vuodesta 2023 alkaen.
- **Varainsiirtovero** on 1,5 prosenttia velattomasta hinnasta 12.10.2023 tai sen jälkeen allekirjoitetuissa kaupoissa. Asumisoikeus ei ole arvopaperi, joten maksun suorittamisesta tai oikeudesta luopumisesta ei makseta varainsiirtoveroa.

Säännöt tulevat taulusta `policy_parameters`, jossa jokaisella säännöllä on voimassaoloaika, lähteen osoite ja hakupäivä. Laskuri käyttää ostopäivänä voimassa olevia sääntöjä.

## Kannattavuusraja

Kannattavuusraja on ensimmäinen kokonainen vuosi, enintään 30, jonka lopussa ostaminen jättää vähintään yhtä paljon varallisuutta kuin vuokraaminen. Jos ostaminen ei saavuta vuokraamista 30 vuodessa, rajaa ei ilmoiteta.

## Entä jos

Entä jos -taulukko laskee koko laskelman uudelleen yhdellä muutetulla oletuksella, molempiin suuntiin, kun molemmat ovat mahdollisia: korot prosenttiyksikön alemmat tai korkeammat, asuntojen hinnat nousevat kaksi prosenttiyksikköä hitaammin tai nopeammin, vuokrat nousevat prosenttiyksikön hitaammin tai kaksi prosenttiyksikköä nopeammin, vastikkeet nousevat kaksi prosenttiyksikköä nopeammin ja säästöjen tuotto on kaksi prosenttiyksikköä pienempi tai suurempi. Jokainen muutos tehdään omaan suunnitelmaasi. Taulukko näyttää, vaihtuuko paras vaihtoehto.

## Mistä oletusarvot tulevat

| Syöte | Oletusarvo |
|---|---|
| Neliöhinta | Viimeisin julkaistu keskiarvo postinumeroalueelle ja huonelukuryhmälle tai lähimmälle suuremmalle alueelle, jolta tietoja on julkaistu (hinta-alueen osa-alue, kunta, maakunta, koko maa), kerrottuna rakennusvuoden kertoimella. Kerroin on saman vuosikymmenen aikana valmistuneiden asuntojen neliöhinta jaettuna saman postinumeroalueen kaikkien asuntojen neliöhinnalla samana vuonna, keskiarvona vuosilta 2017–2021 kauppojen määrillä painotettuna. Tilastokeskus julkaisi hinnat valmistumisvuosikymmenittäin vuoteen 2021 asti. Jos postinumeroalueella on alle 30 saman vuosikymmenen kauppaa, kerroin otetaan hinta-alueen osa-alueelta, kunnasta, maakunnasta tai koko maasta |
| Neliövuokra | Viimeisin vapaarahoitteisten asuntojen uusien vuokrasopimusten vuokra vuokra-alueen osa-alueella tai kunnassa, maakunnassa tai koko maassa |
| Hintojen kasvu | Lähimmän hintaindeksin alueen hintaindeksin keskimääräinen vuosikasvu viimeisten 10 vuoden ajalta |
| Vuokrien kasvu | Tavallinen vuokrasopimuksen indeksiehto: inflaatio viimeisten 10 vuoden ajalta (kuluttajahintaindeksi), vähintään 2 prosenttia vuodessa. Vaihtoehtona on vuokra-alueen markkinavuokrien kasvu viimeisten 10 vuoden ajalta |
| Hoitovastike | Asunto-osakeyhtiöiden talous pääkaupunkiseudulla tai muualla Suomessa, viimeisin vuosi, skaalattuna valmistumiskauden mukaan |
| Hoitovastikkeen kasvu | Sama vuosikasvu kuin käyttövastikkeissa, joten molempien vaihtoehtojen vastikkeet nousevat samaa tahtia. Sovellus näyttää myös alueen taloyhtiöiden vastikkeiden 10 vuoden kasvun |
| Rahoitusvastike | Asunto-osakeyhtiöiden pääomavastikkeet valmistumiskauden mukaan rakennuksen iän mukaisesti |
| Asunnon sisäiset korjaukset | Omistusasujien teettämät korjaukset neliötä kohden, viimeisten viiden vuoden keskiarvo |
| Korko | Viimeisin uusien vaihtuvakorkoisten asuntolainojen keskikorko Suomessa (EKP:n tilastot), kiinteänä koko laina-ajan. Vaihtuva korko on valittavissa sovelluksessa |
| Säästötilin korko | Viimeisin kotitalouksien uusien enintään vuoden talletusten keskikorko Suomessa (EKP:n tilastot) |
| Asumisoikeusmaksu | 15 prosenttia velattomasta hinnasta. Laki asumisoikeusasunnoista (393/2021, 9 §) rajaa asumisoikeusmaksut valtion tukemissa taloissa enintään 15 prosenttiin ja vapaarahoitteisissa taloissa 30 prosenttiin talon hankinta-arvosta; velaton hinta, joka seuraa rakennusvuotta, kuvaa tätä arvoa. Muokattavissa |
| Käyttövastike | Oletus: 85 prosenttia alueen markkinavuokrasta. Lain 33 §:n mukaan valtion tukemien talojen käyttövastikkeen on oltava pienempi kuin vastaavien vuokra-asuntojen vuokra. Muokattavissa |
| Käyttövastikkeen kasvu | Asumisoikeusasuntojen käyttövastikkeiden keskimääräinen vuotuinen muutos koko maassa vuosina 2019–2025 Varken markkinakatsausten mukaan |
| Palautuksen kasvu | Oletus: palautusta korottava rakennuskustannusindeksi nousee 1 prosentin vuodessa, mikä on vähemmän kuin sen kasvu viimeisten 10 vuoden aikana; sovellus näyttää kasvun. Muokattavissa |
| Myyntikulut, sijoitusten tuotto, laina-aika, omarahoitus | Oletukset taulussa `assumptions`, kaikki muokattavissa: 25 vuoden laina, 20 prosentin omarahoitus |
| Rakennusvuosi | 1980; muokattavissa, ja tyhjennettynä laskuri käyttää kaikkien rakennusvuosien keskiarvoja |

## Yksinkertaistukset

- Omistaja asuu asunnossa koko tarkastelujakson, joten verovapaan myynnin kahden vuoden sääntö riippuu vain jakson pituudesta.
- Pääomatuloja verotetaan koko ajan 30 prosentin mukaan.
- Rahasto-osuuksien tappioita ei vähennetä muista tuloista.
- Luototuskaton tarkistus vertaa asuntolainaa velattomaan hintaan.
- Vuokrat, vastikkeet ja maksut ovat keskiarvoja. Yksittäinen asunto voi poiketa niistä, minkä vuoksi jokaisen luvun voi korvata todellisen asuntoilmoituksen luvulla.

## Tietolähteet

- Tilastokeskus: osakeasuntojen hinnat, asuntojen vuokrat, asunto-osakeyhtiöiden talous, korjausrakentaminen, kuluttajahintaindeksi, rakennuskustannusindeksi, Paavo-postinumeroalueet ja luokituspalvelu. Lisenssi CC BY 4.0. Lähde: Tilastokeskus.
- Euroopan keskuspankki: rahalaitosten korkotilastot Suomesta, asuntolainat ja kotitalouksien talletukset. Lähde: EKP:n tilastot.
- Verohallinto (vero.fi): varainsiirtovero, pääomatulovero sekä asunnon, rahasto-osuuksien ja asumisoikeuden luovutusten verotus.
- Valtiovarainministeriö (vm.fi): talletusten korkojen lähdevero.
- Valtiokonttori: ASP-järjestelmä.
- Varke (Asumisen rahoitus- ja kehittämiskeskus): asumisoikeusasuntojen markkinakatsaukset 2019–2025.
- Finlex: laki asumisoikeusasunnoista 393/2021, mukaan lukien asumisoikeusmaksujen enimmäismäärä (9 §) ja sääntö, jonka mukaan käyttövastikkeen on oltava vastaavia vuokria pienempi (33 §).
- Finanssivalvonta: enimmäisluototussuhde.
- Posti: perusosoitteisto, eli Manner-Suomen postinumeroalueiden kadut ja osoitenumerovälit, joiden avulla laskuri löytää osoitteen postinumeron. Maksuton Postin [käyttöehtojen](https://www.posti.fi/mzj3zpe8qb7p/1eKbwM2WAEY5AuGi5TrSZ7/c76a865cf5feb2c527a114b8615e9580/posti-postal-code-services-service-description-and-terms-of-use-20150101.pdf) mukaisesti; haku näyttää tiedoston latauspäivän. Tiedosto päivitetään jokaisen kuukausittaisen tietopäivityksen yhteydessä.
