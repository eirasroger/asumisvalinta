import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { Locale } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";

export const OG_SIZE = { width: 1200, height: 630 };

/** The map is 2000 × 588; its height matches the front page, where Finland fills the hero. */
const MAP_HEIGHT = 660;
const MAP_WIDTH = Math.round((MAP_HEIGHT * 2000) / 588);

export const ogAlt = (locale: Locale) => `Asumisvalinta: ${MESSAGES[locale].home.tagline}`;

async function googleFont(weight: number) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@${weight}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error(`Schibsted Grotesk ${weight}: no TrueType file`);
  return (await fetch(url)).arrayBuffer();
}

/** The front page as a link preview: logo, name and tagline over the price map of Finland. */
export async function ogImage(locale: Locale) {
  const [map, regular, semibold] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "home", "finland.svg"), "base64"),
    googleFont(400),
    googleFont(600),
  ]);
  const halo = "0 0 8px #f3f5f7, 0 0 18px #f3f5f7";
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f3f5f7", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not served as a page */}
        <img
          src={`data:image/svg+xml;base64,${map}`}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          alt=""
          style={{ position: "absolute", top: -6, left: (OG_SIZE.width - MAP_WIDTH) / 2 }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "0 150px",
            fontFamily: "Schibsted Grotesk",
            color: "#1a2530",
          }}
        >
          <svg width="104" height="104" viewBox="0 0 48 48">
            <path
              d="M7 22 24 7l17 15M11 19.5V41h26V19.5"
              fill="none"
              stroke="#1a2530"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="17" y="27" width="4" height="9" rx="1" fill="#eb6834" />
            <rect x="22" y="24" width="4" height="12" rx="1" fill="#1baf7a" />
            <rect x="27" y="21" width="4" height="15" rx="1" fill="#2a78d6" />
          </svg>
          <div style={{ marginTop: 22, fontSize: 92, fontWeight: 600, letterSpacing: -3.2, lineHeight: 1, textShadow: halo }}>
            Asumisvalinta
          </div>
          <div style={{ marginTop: 26, fontSize: 34, lineHeight: 1.4, textAlign: "center", textShadow: halo }}>
            {MESSAGES[locale].home.tagline}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Schibsted Grotesk", data: regular, weight: 400, style: "normal" },
        { name: "Schibsted Grotesk", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
