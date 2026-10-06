import type { Locale } from "@/i18n/config";
import { PRIVACY_EMAIL } from "@/lib/site";

const LINK = "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const LIST =
  "space-y-3 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:top-[0.75em] [&>li]:before:left-0.5 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-buy";
const CONTROLLER = "Roger Vergés";

const Email = () => (
  <a className={LINK} href={`mailto:${PRIVACY_EMAIL}`}>
    {PRIVACY_EMAIL}
  </a>
);

interface Notice {
  title: string;
  intro: string;
  updated: string;
  contents: string;
  sections: { title: string; body: React.ReactNode }[];
}

const NOTICES: Record<Locale, Notice> = {
  en: {
    title: "Privacy notice",
    intro: "This notice explains which personal data Asumisvalinta processes and why.",
    updated: "Last updated 5 October 2026",
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
            <li>Page views, counted by Cloudflare Web Analytics without cookies or other identifiers.</li>
            <li>
              A keyed one-way hash of the IP address, used only to limit how often requests can be sent. The key
              changes daily and the hash is stored apart from all other data.
            </li>
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
            <li>
              Hosting providers (Cloudflare, Google Cloud). The API runs in Finland and stored data are located
              in the EU.
            </li>
          </ul>
        ),
      },
      {
        title: "Retention",
        body: "Usage data and questions are deleted after twelve months. IP address hashes are deleted after one day.",
      },
      {
        title: "Cookies",
        body: "The service does not use cookies. Do Not Track and Global Privacy Control signals are respected.",
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
    updated: "Päivitetty 5.10.2026",
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
            <li>Sivujen katselukerrat, jotka Cloudflare Web Analytics laskee ilman evästeitä tai muita tunnisteita.</li>
            <li>
              IP-osoitteesta avaimella muodostettu yksisuuntainen tiiviste, jota käytetään vain pyyntöjen tiheyden
              rajoittamiseen. Avain vaihtuu päivittäin, ja tiiviste säilytetään erillään muista tiedoista.
            </li>
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
            <li>
              Ylläpitopalvelujen tarjoajat (Cloudflare, Google Cloud). Palvelun rajapinta toimii Suomessa, ja
              tallennetut tiedot sijaitsevat EU:ssa.
            </li>
          </ul>
        ),
      },
      {
        title: "Säilytysaika",
        body: "Käyttötiedot ja kysymykset poistetaan kahdentoista kuukauden kuluttua. IP-osoitteiden tiivisteet poistetaan yhden päivän kuluttua.",
      },
      {
        title: "Evästeet",
        body: "Palvelu ei käytä evästeitä. Do Not Track- ja Global Privacy Control -signaaleja noudatetaan.",
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
  const notice = NOTICES[locale];
  return (
    <div className="bg-paper">
      <header className="relative overflow-hidden bg-[#0e1a26] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
        <img
          src="/about/finland-dots.svg"
          alt=""
          className="map-reveal pointer-events-none absolute top-[-60%] right-[2%] w-[340px] opacity-40 [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:w-[520px]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24">
          <h1 className="fade-up text-[44px] leading-none font-semibold tracking-[-0.04em] sm:text-[76px]">{notice.title}</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-24 sm:px-6 sm:pt-16 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
        <nav aria-label={notice.contents} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-medium tracking-wider text-ink-3 uppercase">{notice.contents}</p>
            <ol className="mt-4 space-y-2.5 border-l border-line">
              {notice.sections.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#section-${index + 1}`}
                    className="-ml-px block border-l border-transparent pl-4 text-sm text-ink-2 transition-colors hover:border-ink hover:text-ink"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-[680px] min-w-0 text-[16px] leading-[1.8] text-ink-2">
          <p className="text-lg leading-relaxed text-ink">{notice.intro}</p>
          <p className="mt-2 text-sm text-ink-3">{notice.updated}</p>
          {notice.sections.map((section, index) => (
            <section key={section.title} id={`section-${index + 1}`} className="mt-14 scroll-mt-24">
              <h2 className="mb-4 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">{section.title}</h2>
              <div>{section.body}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
