import Link from "next/link";
import { Arrow } from "@/components/icons";
import { MIST, NIGHT } from "@/components/showcase";
import { type Locale, localePath } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { CONTACT_EMAIL, PRIVACY_EMAIL, SITE_URL } from "@/lib/site";

const PROVIDER = "Roger Vergés";

const ICONS = {
  mail: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Zm.5.5 8.5 6 8.5-6" />,
  shield: <path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.5 4-1.1 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4" />,
};

function Channel({
  icon,
  title,
  body,
  email,
  children,
}: {
  icon: keyof typeof ICONS;
  title: string;
  body: string;
  email: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-[28px] border border-line bg-paper p-7 shadow-float sm:p-9">
      <span className={`flex size-12 items-center justify-center rounded-2xl ${MIST} text-buy`}>
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[icon]}
        </svg>
      </span>
      <h2 className="mt-6 text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-4 pt-8">
        <a
          href={`mailto:${email}`}
          className="group flex h-12 w-fit max-w-full items-center gap-2 rounded-xl bg-buy px-6 text-[15px] font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          <span className="truncate">{email}</span>
          <Arrow className="shrink-0 transition-transform group-hover:translate-x-0.5" />
        </a>
        {children}
      </div>
    </div>
  );
}

export function ContactView({ locale }: { locale: Locale }) {
  const c = MESSAGES[locale].contact;
  const href = (page: string) => localePath(locale, page);
  const details = [
    { label: c.operator, value: PROVIDER },
    { label: c.response, value: c.responseValue },
    { label: c.website, value: new URL(SITE_URL).host },
  ];

  return (
    <div className="bg-paper">
      <header className={`relative overflow-hidden ${NIGHT} text-white`}>
        <div className="pointer-events-none absolute top-[-60%] right-[2%] w-[340px] opacity-25 [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:w-[520px] sm:opacity-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
          <img src="/about/finland-dots.svg" alt="" className="map-reveal w-full" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24">
          <h1 className="fade-up text-[44px] leading-none font-semibold tracking-[-0.04em] sm:text-[76px]">{c.title}</h1>
          <p className="fade-up mt-6 max-w-xl text-lg leading-relaxed text-white/70" style={{ animationDelay: "120ms" }}>
            {c.lead}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16 sm:pb-32">
        <div className="grid gap-5 md:grid-cols-2">
          <Channel icon="mail" title={c.general.title} body={c.general.body} email={CONTACT_EMAIL} />
          <Channel icon="shield" title={c.privacy.title} body={c.privacy.body} email={PRIVACY_EMAIL}>
            <Link href={href("/privacy")} className="group inline-flex items-center gap-1.5 text-sm font-medium hover:text-ink-2">
              {c.privacy.link}
              <Arrow className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Channel>
        </div>

        <dl className="mt-14 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs font-medium tracking-wider text-ink-3 uppercase">{detail.label}</dt>
              <dd className="mt-2 text-[16px] text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-14 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-ink-2">
          {c.noAdvice}
          <Link href={href("/oppaat")} className="group inline-flex items-center gap-1.5 font-medium text-ink hover:text-ink-2">
            {c.guides}
            <Arrow className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </p>
      </div>
    </div>
  );
}