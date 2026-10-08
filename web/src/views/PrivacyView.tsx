import type { Locale } from "@/i18n/config";
import { ADS_LIVE, PRIVACY_EMAIL } from "@/lib/site";
import { LINK, LIST, type LegalText, LegalView } from "@/views/LegalView";

const CONTROLLER = "Roger Vergés";
const GOOGLE_AD_SETTINGS = "https://www.google.com/settings/ads";

const Email = () => (
  <a className={LINK} href={`mailto:${PRIVACY_EMAIL}`}>
    {PRIVACY_EMAIL}
  </a>
);

const NOTICES: Record<Locale, LegalText> = {
  en: {
    title: "Privacy notice",
    intro: "This notice explains which personal data Asumisvalinta processes and why.",
    updated: "Last updated 8 October 2026",
    contents: "Contents",
    sections: [
      {
        title: "Controller",
        body: (
          <>
            The controller is {CONTROLLER}. Contact: <Email />.
          </>
        ),
      },
      {
        title: "Data processed",
        body: (
          <ul className={LIST}>
            <li>
              Usage data: inputs to the calculator and the map, and the results shown. Events from one visit share a
              random number that is created when the page loads and is not stored on your device.
            </li>
            <li>
              Questions submitted to the assistant and the status of the answer. Questions from one visit share a
              random number that limits how many can be asked; it lives only in the open page and is not stored on
              your device.
            </li>
            <li>Page views, counted without cookies or other identifiers.</li>
            <li>
              A keyed one-way hash of the IP address, used only to limit how often requests can be sent. The key
              changes daily and the hash is stored apart from all other data.
            </li>
            {ADS_LIVE && <li>Cookies used to show ads.</li>}
          </ul>
        ),
      },
      {
        title: "Purpose and legal basis",
        body: (
          <ul className={LIST}>
            <li>Operating, developing and securing the service: legitimate interest (Article 6(1)(f) GDPR).</li>
            <li>
              Answering questions submitted to the assistant and their use for training AI models: consent (Article
              6(1)(a) GDPR).
            </li>
            {ADS_LIVE && <li>Showing ads: consent (Article 6(1)(a) GDPR).</li>}
          </ul>
        ),
      },
      {
        title: "Recipients and transfers",
        body: (
          <ul className={LIST}>
            <li>
              AI service providers: questions submitted to the assistant, including for the training of AI models.
              Within a conversation, earlier questions and answers are sent again with each new question. Data may
              be transferred outside the EU/EEA subject to appropriate safeguards (Chapter V GDPR).
            </li>
            <li>Hosting providers. The API runs in Finland and stored data are located in the EU.</li>
            {ADS_LIVE && (
              <li>
                Google, which shows the ads. Data may be transferred outside the EU/EEA subject to appropriate
                safeguards (Chapter V GDPR).
              </li>
            )}
          </ul>
        ),
      },
      {
        title: "Retention",
        body: "Usage data and questions are deleted after twelve months. IP address hashes are deleted after one day.",
      },
      {
        title: "Cookies",
        body: ADS_LIVE ? (
          <>
            The service itself does not use cookies. Google and other ad vendors use cookies to show ads based on your
            visits to this and other websites. Ad cookies are used only with your consent, which you can change at any
            time under &quot;Privacy and cookie settings&quot; at the bottom of the page. You can turn off personalised
            ads in Google&apos;s{" "}
            <a className={LINK} href={GOOGLE_AD_SETTINGS}>
              Ads Settings
            </a>
            .
          </>
        ) : (
          "The service does not use cookies. Do Not Track and Global Privacy Control signals are respected."
        ),
      },
      {
        title: "Your rights",
        body: (
          <>
            You have the right to access, rectify and erase your personal data, to object to its processing and to
            lodge a complaint with the Data Protection Ombudsman (
            <a className={LINK} href="https://tietosuoja.fi/en">
              tietosuoja.fi
            </a>
            ). Where processing is based on consent, you may withdraw it at any time. Withdrawal does not affect the
            lawfulness of processing based on consent before its withdrawal.
            <p className="mt-3">
              The controller does not link usage data or questions to an identified person and is not required to
              obtain additional information for that purpose (Article 11(1) GDPR). Where the controller is unable to
              identify you, your rights of access, rectification, erasure, restriction of processing and data
              portability under Articles 15 to 20 GDPR apply once you provide additional information that enables your
              data to be identified (Article 11(2) GDPR), such as the exact wording of a question you submitted and the
              approximate date and time it was sent. Requests should be sent to the contact address above.
            </p>
          </>
        ),
      },
    ],
  },
  fi: {
    title: "Tietosuojaseloste",
    intro: "Tämä seloste kertoo, mitä henkilötietoja Asumisvalinta käsittelee ja miksi.",
    updated: "Päivitetty 8.10.2026",
    contents: "Sisällys",
    sections: [
      {
        title: "Rekisterinpitäjä",
        body: (
          <>
            Rekisterinpitäjä on {CONTROLLER}. Yhteystiedot: <Email />.
          </>
        ),
      },
      {
        title: "Käsiteltävät tiedot",
        body: (
          <ul className={LIST}>
            <li>
              Käyttötiedot: laskuriin ja karttaan syötetyt tiedot ja näytetyt tulokset. Saman käynnin tapahtumat
              yhdistää satunnaisluku, joka luodaan sivun latautuessa eikä sitä tallenneta laitteellesi.
            </li>
            <li>
              Avustajalle lähetetyt kysymykset ja vastauksen tila. Saman käynnin kysymykset yhdistää satunnaisluku,
              jolla rajoitetaan kysymysten määrää; se on olemassa vain avoimella sivulla eikä sitä tallenneta
              laitteellesi.
            </li>
            <li>Sivujen katselukerrat, jotka lasketaan ilman evästeitä tai muita tunnisteita.</li>
            <li>
              IP-osoitteesta avaimella muodostettu yksisuuntainen tiiviste, jota käytetään vain pyyntöjen tiheyden
              rajoittamiseen. Avain vaihtuu päivittäin, ja tiiviste säilytetään erillään muista tiedoista.
            </li>
            {ADS_LIVE && <li>Mainosten näyttämiseen käytettävät evästeet.</li>}
          </ul>
        ),
      },
      {
        title: "Käsittelyn tarkoitus ja oikeusperuste",
        body: (
          <ul className={LIST}>
            <li>
              Palvelun ylläpito, kehittäminen ja suojaaminen: rekisterinpitäjän oikeutettu etu (tietosuoja-asetuksen 6
              artiklan 1 kohdan f alakohta).
            </li>
            <li>
              Avustajalle lähetettyihin kysymyksiin vastaaminen ja niiden käyttö tekoälymallien kouluttamiseen:
              suostumus (6 artiklan 1 kohdan a alakohta).
            </li>
            {ADS_LIVE && <li>Mainosten näyttäminen: suostumus (6 artiklan 1 kohdan a alakohta).</li>}
          </ul>
        ),
      },
      {
        title: "Vastaanottajat ja siirrot",
        body: (
          <ul className={LIST}>
            <li>
              Tekoälypalvelujen tarjoajat: avustajalle lähetetyt kysymykset, myös tekoälymallien kouluttamista varten.
              Saman keskustelun aiemmat kysymykset ja vastaukset lähetetään uudelleen jokaisen uuden kysymyksen
              mukana. Tietoja voidaan siirtää EU:n tai ETA:n ulkopuolelle asianmukaisin suojatoimin (tietosuoja-asetuksen V
              luku).
            </li>
            <li>Ylläpitopalvelujen tarjoajat. Palvelun rajapinta toimii Suomessa, ja tallennetut tiedot sijaitsevat EU:ssa.</li>
            {ADS_LIVE && (
              <li>
                Google, joka näyttää mainokset. Tietoja voidaan siirtää EU:n tai ETA:n ulkopuolelle asianmukaisin
                suojatoimin (tietosuoja-asetuksen V luku).
              </li>
            )}
          </ul>
        ),
      },
      {
        title: "Säilytysaika",
        body: "Käyttötiedot ja kysymykset poistetaan kahdentoista kuukauden kuluttua. IP-osoitteiden tiivisteet poistetaan yhden päivän kuluttua.",
      },
      {
        title: "Evästeet",
        body: ADS_LIVE ? (
          <>
            Palvelu itse ei käytä evästeitä. Google ja muut mainostoimittajat käyttävät evästeitä näyttääkseen mainoksia
            käyntiesi perusteella tällä ja muilla sivustoilla. Mainosevästeitä käytetään vain suostumuksellasi, ja voit
            muuttaa valintaasi milloin tahansa sivun alareunan kohdasta Tietosuoja- ja evästeasetukset. Voit poistaa
            kohdennetut mainokset käytöstä Googlen{" "}
            <a className={LINK} href={GOOGLE_AD_SETTINGS}>
              mainosasetuksissa
            </a>
            .
          </>
        ) : (
          "Palvelu ei käytä evästeitä. Do Not Track- ja Global Privacy Control -signaaleja noudatetaan."
        ),
      },
      {
        title: "Oikeutesi",
        body: (
          <>
            Sinulla on oikeus saada pääsy henkilötietoihisi, oikaista ja poistaa ne, vastustaa niiden käsittelyä sekä
            tehdä valitus tietosuojavaltuutetun toimistolle (
            <a className={LINK} href="https://tietosuoja.fi">
              tietosuoja.fi
            </a>
            ). Kun käsittely perustuu suostumukseen, voit peruuttaa sen milloin tahansa. Suostumuksen peruuttaminen
            ei vaikuta suostumuksen perusteella ennen sen peruuttamista suoritetun käsittelyn lainmukaisuuteen.
            <p className="mt-3">
              Rekisterinpitäjä ei yhdistä käyttötietoja tai kysymyksiä tunnistettuun henkilöön, eikä sen ole
              velvollinen hankkimaan lisätietoja tätä varten (tietosuoja-asetuksen 11 artiklan 1 kohta). Jos
              rekisterinpitäjä ei pysty tunnistamaan sinua, 15–20 artiklan mukaiset oikeutesi saada pääsy tietoihin,
              oikaista ja poistaa niitä, rajoittaa niiden käsittelyä ja siirtää ne järjestelmästä toiseen ovat
              käytettävissä, kun annat lisätietoja, joiden avulla tietosi voidaan tunnistaa (11 artiklan 2 kohta),
              kuten lähettämäsi kysymyksen tarkan sanamuodon ja sen likimääräisen lähetysajan. Pyynnöt lähetetään
              yllä olevaan osoitteeseen.
            </p>
          </>
        ),
      },
    ],
  },
};

export function PrivacyView({ locale }: { locale: Locale }) {
  return <LegalView text={NOTICES[locale]} />;
}
