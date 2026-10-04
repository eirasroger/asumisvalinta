export const metadata = { title: "Privacy notice · Asumisvalinta" };

const LINK = "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const CONTROLLER = "Roger Vergés";
const CONTACT = "asumisvalinta@gmail.com";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 pb-16 text-[15px] leading-relaxed text-ink-2 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">Privacy notice</h1>
      <p className="mt-1 text-sm text-ink-3">Last updated 4 October 2026</p>

      <Section number={1} title="Controller">
        The controller is {CONTROLLER}. Contact:{" "}
        <a className={LINK} href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        .
      </Section>

      <Section number={2} title="Data processed">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Usage data: inputs to the calculator and the map, and the results shown. Events from one visit share a
            random number that is created when the page loads and is not stored on your device.
          </li>
          <li>
            Questions submitted to the assistant and the status of the answer. Questions from one visit share a random
            number that limits how many can be asked; it lives only in the open page and is not stored on your device.
          </li>
          <li>Page views, counted by Vercel Web Analytics without identifiers.</li>
          <li>
            A keyed one-way hash of the IP address, used only to limit how often requests can be sent. The key
            changes daily and the hash is stored apart from all other data.
          </li>
        </ul>
      </Section>

      <Section number={3} title="Purpose and legal basis">
        Maintaining and improving the service and protecting it against misuse, on the basis of legitimate interest
        (Article 6(1)(f) GDPR).
      </Section>

      <Section number={4} title="Recipients and transfers">
        Questions are processed by an AI service provider, which may process them outside the EU/EEA under appropriate
        safeguards (Chapter V GDPR). The service is hosted by Vercel and data is stored in a database located in the EU.
      </Section>

      <Section number={5} title="Retention">
        Usage data and questions are deleted after twelve months. IP address hashes are deleted after one day.
      </Section>

      <Section number={6} title="Cookies">
        The service does not use cookies. Do Not Track and Global Privacy Control signals are respected.
      </Section>

      <Section number={7} title="Your rights">
        You have the right to access, rectify and erase your personal data, to object to its processing and to lodge a
        complaint with the Data Protection Ombudsman (
        <a className={LINK} href="https://tietosuoja.fi/en">
          tietosuoja.fi
        </a>
        ).
        <p className="mt-3">
          The controller does not link usage data or questions to an identified person and is not required to obtain
          additional information for that purpose (Article 11(1) GDPR). Where the controller is unable to identify you,
          your rights of access, rectification, erasure, restriction of processing and data portability under Articles
          15 to 20 GDPR apply once you provide additional information that enables your data to be identified (Article
          11(2) GDPR), such as the exact wording of a question you submitted and the approximate date and time it was
          sent. Requests should be sent to the contact address above.
        </p>
      </Section>
    </article>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-1.5 text-[15px] font-semibold text-ink">
        {number}. {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
