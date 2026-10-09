import type { Locale } from "@/i18n/config";
import { ADS_LIVE, PRIVACY_EMAIL } from "@/lib/site";
import { LINK, LIST, type LegalText, LegalView } from "@/views/LegalView";

const CONTROLLER = "Roger Vergés";
const GOOGLE_AD_SETTINGS = "https://www.google.com/settings/ads";
const GOOGLE_PARTNER_SITES = "https://policies.google.com/technologies/partner-sites";

const Email = () => (
  <a className={LINK} href={`mailto:${PRIVACY_EMAIL}`}>
    {PRIVACY_EMAIL}
  </a>
);

const NOTICES: Record<Locale, LegalText> = {
  en: {
    title: "Privacy notice",
    intro:
      "This notice describes how Asumisvalinta processes personal data, in accordance with the EU General Data Protection Regulation (GDPR).",
    updated: "Last updated 9 October 2026",
    contents: "Contents",
    sections: [
      {
        title: "Controller",
        body: (
          <>
            The controller is {CONTROLLER}. Requests and questions concerning personal data: <Email />.
          </>
        ),
      },
      {
        title: "Data processed",
        body: (
          <ul className={LIST}>
            <li>
              Technical data: the IP address and the information that the browser sends with each request, processed
              to deliver the service. To limit how often requests can be sent, a keyed one-way hash of the IP address
              is stored. The key changes daily and the hash is stored apart from all other data.
            </li>
            <li>
              Usage data: the comparisons calculated in the service, including the postal code, the size and building
              year of the flat, the figures and assumptions used, and the results. Usage data is recorded from the
              requests needed to calculate a comparison and is not linked to a person or a visit.
            </li>
            <li>
              Traffic statistics: aggregated figures on the use of the website, such as the number of visits, the
              pages viewed and the countries of visitors, produced by the hosting provider from the requests it
              handles.
            </li>
            <li>
              Questions submitted to the assistant, with your consent: the question, the status of the answer and the
              data sources used. Email addresses, phone numbers, bank account numbers and personal identity codes are
              removed automatically before a question is stored.
            </li>
            {ADS_LIVE && <li>Cookies and similar identifiers used to show ads, with your consent.</li>}
            <li>Messages you send by email, including your name, email address and the content of the message.</li>
          </ul>
        ),
      },
      {
        title: "Purposes and legal bases",
        body: (
          <>
            <ul className={LIST}>
              <li>
                Delivering the service, protecting it against misuse and limiting the number of requests: legitimate
                interest in operating a secure and reliable service (Article 6(1)(f) GDPR).
              </li>
              <li>
                Producing usage and traffic statistics to develop the service: legitimate interest in understanding
                how the service is used and improving it (Article 6(1)(f) GDPR).
              </li>
              <li>
                Answering questions submitted to the assistant, storing them to develop the service, and their use by
                AI service providers for training AI models: consent (Article 6(1)(a) GDPR).
              </li>
              {ADS_LIVE && <li>Showing ads and measuring their performance: consent (Article 6(1)(a) GDPR).</li>}
              <li>
                Responding to messages: legitimate interest in handling enquiries (Article 6(1)(f) GDPR).
              </li>
            </ul>
            <p className="mt-3">
              Providing personal data is not a statutory or contractual requirement. The service can be used without
              giving consent, except for the assistant, which requires consent.
            </p>
          </>
        ),
      },
      {
        title: "Cookies and similar technologies",
        body: (
          <>
            The service itself does not use cookies or store information on your device. Usage and traffic statistics
            are produced on the server from the requests needed to provide the service. If your browser sends a Do Not
            Track or Global Privacy Control signal, your comparisons and questions are not recorded.
            {ADS_LIVE && (
              <p className="mt-3">
                Google and other ad vendors use cookies to show ads, including ads based on your visits to this and
                other websites. Ad cookies are used only with your consent, which is requested through Google&apos;s
                consent message and can be changed under &quot;Privacy and cookie settings&quot;. More information is
                available on{" "}
                <a className={LINK} href={GOOGLE_PARTNER_SITES}>
                  how Google uses information from sites that use its services
                </a>
                , and personalised ads can be turned off in Google&apos;s{" "}
                <a className={LINK} href={GOOGLE_AD_SETTINGS}>
                  Ads Settings
                </a>
                .
              </p>
            )}
          </>
        ),
      },
      {
        title: "Recipients",
        body: (
          <>
            Personal data is disclosed only to service providers that process it on behalf of the controller or for
            the purposes described in this notice:
            <ul className={`${LIST} mt-3`}>
              <li>
                Cloudflare: hosting of the website, protection of the interface, storage of usage data in the EU, and
                traffic statistics.
              </li>
              <li>Google Cloud: hosting of the interface of the service in Finland.</li>
              <li>
                AI service providers: questions submitted to the assistant. Within a conversation, earlier questions
                and answers are sent again with each new question. Questions may be used to train AI models.
              </li>
              {ADS_LIVE && <li>Google and its advertising partners: data used to show ads.</li>}
            </ul>
          </>
        ),
      },
      {
        title: "Transfers outside the EU/EEA",
        body: "Some service providers may process personal data outside the EU/EEA, including in the United States. Such transfers are based on an adequacy decision of the European Commission, such as the EU–US Data Privacy Framework, or on the standard contractual clauses approved by the Commission (Chapter V GDPR).",
      },
      {
        title: "Retention",
        body: (
          <ul className={LIST}>
            <li>Usage data and questions: twelve months.</li>
            <li>IP address hashes: one day.</li>
            <li>Traffic statistics: according to the retention periods of the hosting provider.</li>
            <li>Email messages: as long as needed to handle the matter.</li>
          </ul>
        ),
      },
      {
        title: "Your rights",
        body: (
          <>
            You have the right to access your personal data, to have it rectified or erased, to restrict its
            processing and to receive it in a portable format. You have the right to object to processing based on
            legitimate interest. Where processing is based on consent, you may withdraw consent at any time without
            affecting the lawfulness of processing based on consent before its withdrawal. You also have the right to
            lodge a complaint with the Data Protection Ombudsman (
            <a className={LINK} href="https://tietosuoja.fi/en">
              tietosuoja.fi
            </a>
            ).
            <p className="mt-3">
              The controller does not link usage data or questions to an identified person and is not required to
              obtain additional information for that purpose (Article 11(1) GDPR). Where the controller is unable to
              identify you, your rights under Articles 15 to 20 GDPR apply once you provide additional information
              that enables your data to be identified (Article 11(2) GDPR), such as the exact wording of a question you
              submitted and the approximate date and time it was sent. Requests should be sent to the address above.
            </p>
          </>
        ),
      },
      {
        title: "Automated decision-making",
        body: "Personal data is not used for automated decision-making, including profiling, that produces legal effects concerning you or similarly significantly affects you (Article 22 GDPR).",
      },
      {
        title: "Security",
        body: "Data is transferred over encrypted connections. Access to stored data is restricted, IP addresses are stored only as hashes, and personal details are removed from questions before they are stored.",
      },
      {
        title: "Changes to this notice",
        body: "This notice may be updated. The current version is published on this page, and the date above shows when it was last updated.",
      },
    ],
  },
  fi: {
    title: "Tietosuojaseloste",
    intro:
      "Tämä seloste kertoo, miten Asumisvalinta käsittelee henkilötietoja EU:n yleisen tietosuoja-asetuksen mukaisesti.",
    updated: "Päivitetty 9.10.2026",
    contents: "Sisällys",
    sections: [
      {
        title: "Rekisterinpitäjä",
        body: (
          <>
            Rekisterinpitäjä on {CONTROLLER}. Henkilötietoja koskevat pyynnöt ja kysymykset: <Email />.
          </>
        ),
      },
      {
        title: "Käsiteltävät tiedot",
        body: (
          <ul className={LIST}>
            <li>
              Tekniset tiedot: IP-osoite ja tiedot, jotka selain lähettää jokaisen pyynnön mukana. Niitä käsitellään
              palvelun toimittamiseksi. Pyyntöjen tiheyden rajoittamiseksi tallennetaan IP-osoitteesta avaimella
              muodostettu yksisuuntainen tiiviste. Avain vaihtuu päivittäin, ja tiiviste säilytetään erillään muista
              tiedoista.
            </li>
            <li>
              Käyttötiedot: palvelussa lasketut vertailut, mukaan lukien postinumero, asunnon koko ja rakennusvuosi,
              käytetyt luvut ja oletukset sekä tulokset. Käyttötiedot tallennetaan vertailun laskemiseen tarvittavista
              pyynnöistä, eikä niitä yhdistetä henkilöön tai käyntiin.
            </li>
            <li>
              Liikennetilastot: koostetut luvut verkkosivuston käytöstä, kuten käyntien määrä, katsotut sivut ja
              kävijöiden maat. Ylläpitopalvelun tarjoaja muodostaa ne käsittelemistään pyynnöistä.
            </li>
            <li>
              Avustajalle lähetetyt kysymykset suostumuksellasi: kysymys, vastauksen tila ja käytetyt tietolähteet.
              Sähköpostiosoitteet, puhelinnumerot, tilinumerot ja henkilötunnukset poistetaan automaattisesti ennen
              kysymyksen tallentamista.
            </li>
            {ADS_LIVE && <li>Mainosten näyttämiseen käytettävät evästeet ja vastaavat tunnisteet suostumuksellasi.</li>}
            <li>Sähköpostitse lähettämäsi viestit, mukaan lukien nimesi, sähköpostiosoitteesi ja viestin sisältö.</li>
          </ul>
        ),
      },
      {
        title: "Käsittelyn tarkoitukset ja oikeusperusteet",
        body: (
          <>
            <ul className={LIST}>
              <li>
                Palvelun toimittaminen, sen suojaaminen väärinkäytöltä ja pyyntöjen määrän rajoittaminen:
                rekisterinpitäjän oikeutettu etu ylläpitää turvallista ja toimivaa palvelua (tietosuoja-asetuksen 6
                artiklan 1 kohdan f alakohta).
              </li>
              <li>
                Käyttö- ja liikennetilastojen tuottaminen palvelun kehittämiseksi: oikeutettu etu ymmärtää palvelun
                käyttöä ja parantaa sitä (6 artiklan 1 kohdan f alakohta).
              </li>
              <li>
                Avustajalle lähetettyihin kysymyksiin vastaaminen, niiden tallentaminen palvelun kehittämiseksi ja
                niiden käyttö tekoälypalvelujen tarjoajien mallien kouluttamiseen: suostumus (6 artiklan 1 kohdan a
                alakohta).
              </li>
              {ADS_LIVE && (
                <li>Mainosten näyttäminen ja niiden tehokkuuden mittaaminen: suostumus (6 artiklan 1 kohdan a alakohta).</li>
              )}
              <li>Viesteihin vastaaminen: oikeutettu etu käsitellä yhteydenottoja (6 artiklan 1 kohdan f alakohta).</li>
            </ul>
            <p className="mt-3">
              Henkilötietojen antaminen ei ole lakisääteinen tai sopimukseen perustuva vaatimus. Palvelua voi käyttää
              antamatta suostumusta, lukuun ottamatta avustajaa, jonka käyttö edellyttää suostumusta.
            </p>
          </>
        ),
      },
      {
        title: "Evästeet ja vastaavat tekniikat",
        body: (
          <>
            Palvelu itse ei käytä evästeitä eikä tallenna tietoja laitteellesi. Käyttö- ja liikennetilastot
            muodostetaan palvelimella palvelun tarjoamiseen tarvittavista pyynnöistä. Jos selaimesi lähettää Do Not
            Track- tai Global Privacy Control -signaalin, vertailujasi ja kysymyksiäsi ei tallenneta.
            {ADS_LIVE && (
              <p className="mt-3">
                Google ja muut mainostoimittajat käyttävät evästeitä mainosten näyttämiseen, myös käyntiesi perusteella
                tällä ja muilla sivustoilla kohdennettuihin mainoksiin. Mainosevästeitä käytetään vain
                suostumuksellasi, jota pyydetään Googlen suostumusviestillä ja jota voit muuttaa kohdasta Tietosuoja- ja
                evästeasetukset. Lisätietoa on sivulla{" "}
                <a className={LINK} href={GOOGLE_PARTNER_SITES}>
                  miten Google käyttää sen palveluja käyttävien sivustojen tietoja
                </a>
                , ja kohdennetut mainokset voi poistaa käytöstä Googlen{" "}
                <a className={LINK} href={GOOGLE_AD_SETTINGS}>
                  mainosasetuksissa
                </a>
                .
              </p>
            )}
          </>
        ),
      },
      {
        title: "Vastaanottajat",
        body: (
          <>
            Henkilötietoja luovutetaan vain palveluntarjoajille, jotka käsittelevät niitä rekisterinpitäjän lukuun tai
            tässä selosteessa kuvattuihin tarkoituksiin:
            <ul className={`${LIST} mt-3`}>
              <li>
                Cloudflare: verkkosivuston ylläpito, rajapinnan suojaus, käyttötietojen tallennus EU:ssa ja
                liikennetilastot.
              </li>
              <li>Google Cloud: palvelun rajapinnan ylläpito Suomessa.</li>
              <li>
                Tekoälypalvelujen tarjoajat: avustajalle lähetetyt kysymykset. Saman keskustelun aiemmat kysymykset ja
                vastaukset lähetetään uudelleen jokaisen uuden kysymyksen mukana. Kysymyksiä voidaan käyttää
                tekoälymallien kouluttamiseen.
              </li>
              {ADS_LIVE && <li>Google ja sen mainoskumppanit: mainosten näyttämiseen käytettävät tiedot.</li>}
            </ul>
          </>
        ),
      },
      {
        title: "Siirrot EU:n tai ETA:n ulkopuolelle",
        body: "Osa palveluntarjoajista voi käsitellä henkilötietoja EU:n tai ETA:n ulkopuolella, myös Yhdysvalloissa. Siirrot perustuvat Euroopan komission tietosuojan riittävyyttä koskevaan päätökseen, kuten EU:n ja Yhdysvaltojen väliseen tietosuojakehykseen, tai komission hyväksymiin vakiosopimuslausekkeisiin (tietosuoja-asetuksen V luku).",
      },
      {
        title: "Säilytysaika",
        body: (
          <ul className={LIST}>
            <li>Käyttötiedot ja kysymykset: kaksitoista kuukautta.</li>
            <li>IP-osoitteiden tiivisteet: yksi päivä.</li>
            <li>Liikennetilastot: ylläpitopalvelun tarjoajan säilytysaikojen mukaisesti.</li>
            <li>Sähköpostiviestit: niin kauan kuin asian käsittely edellyttää.</li>
          </ul>
        ),
      },
      {
        title: "Oikeutesi",
        body: (
          <>
            Sinulla on oikeus saada pääsy henkilötietoihisi, oikaista ja poistaa ne, rajoittaa niiden käsittelyä ja
            siirtää ne järjestelmästä toiseen. Sinulla on oikeus vastustaa oikeutettuun etuun perustuvaa käsittelyä.
            Kun käsittely perustuu suostumukseen, voit peruuttaa sen milloin tahansa. Peruuttaminen ei vaikuta ennen
            peruuttamista suostumuksen perusteella suoritetun käsittelyn lainmukaisuuteen. Sinulla on myös oikeus tehdä
            valitus tietosuojavaltuutetun toimistolle (
            <a className={LINK} href="https://tietosuoja.fi">
              tietosuoja.fi
            </a>
            ).
            <p className="mt-3">
              Rekisterinpitäjä ei yhdistä käyttötietoja tai kysymyksiä tunnistettuun henkilöön, eikä sen ole
              velvollinen hankkimaan lisätietoja tätä varten (tietosuoja-asetuksen 11 artiklan 1 kohta). Jos
              rekisterinpitäjä ei pysty tunnistamaan sinua, 15–20 artiklan mukaiset oikeutesi ovat käytettävissä, kun
              annat lisätietoja, joiden avulla tietosi voidaan tunnistaa (11 artiklan 2 kohta), kuten lähettämäsi
              kysymyksen tarkan sanamuodon ja sen likimääräisen lähetysajan. Pyynnöt lähetetään yllä olevaan
              osoitteeseen.
            </p>
          </>
        ),
      },
      {
        title: "Automaattinen päätöksenteko",
        body: "Henkilötietoja ei käytetä automaattiseen päätöksentekoon, kuten profilointiin, jolla on sinua koskevia oikeusvaikutuksia tai joka vaikuttaa sinuun vastaavalla tavalla merkittävästi (tietosuoja-asetuksen 22 artikla).",
      },
      {
        title: "Tietoturva",
        body: "Tiedot siirretään salattuja yhteyksiä käyttäen. Pääsy tallennettuihin tietoihin on rajattu, IP-osoitteet tallennetaan vain tiivisteinä, ja henkilötiedot poistetaan kysymyksistä ennen niiden tallentamista.",
      },
      {
        title: "Selosteen muuttaminen",
        body: "Tätä selostetta voidaan päivittää. Voimassa oleva versio julkaistaan tällä sivulla, ja yllä oleva päivämäärä kertoo, milloin selostetta on viimeksi päivitetty.",
      },
    ],
  },
};

export function PrivacyView({ locale }: { locale: Locale }) {
  return <LegalView text={NOTICES[locale]} />;
}
