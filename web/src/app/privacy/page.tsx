export const metadata = { title: "Privacy notice · Asumisvalinta" };

const LINK = "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 pb-16 text-[15px] leading-relaxed text-ink-2 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">Privacy notice</h1>
      <p className="mt-1 text-sm text-ink-3">Last updated 30 September 2026</p>

      <Section number={1} title="Controller">
        The controller is the operator of Asumisvalinta.
        {contact && (
          <>
            {" "}
            Contact:{" "}
            <a className={LINK} href={`mailto:${contact}`}>
              {contact}
            </a>
            .
          </>
        )}
      </Section>

      <Section number={2} title="Data processed">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Usage data: inputs to the calculator and the map, and the results shown. Collected without identifiers.</li>
          <li>Questions submitted to the assistant and the status of the answer.</li>
        </ul>
      </Section>

      <Section number={3} title="Purpose and legal basis">
        Maintaining and improving the service, on the basis of legitimate interest (Article 6(1)(f) GDPR).
      </Section>

      <Section number={4} title="Recipients and transfers">
        Questions are processed by an AI service provider, which may process them outside the EU/EEA under appropriate
        safeguards (Chapter V GDPR). The service is hosted by Vercel and data is stored in a database located in the EU.
      </Section>

      <Section number={5} title="Retention">
        Data is deleted after twelve months.
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
