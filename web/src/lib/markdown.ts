/** Splits markdown before its middle `## ` heading, where a mid-page ad goes; short texts stay whole. */
export function splitAtMiddle(text: string): [string, string] {
  const starts = [...text.matchAll(/^## /gm)].map((match) => match.index);
  if (starts.length < 4) return [text, ""];
  const cut = starts[Math.floor(starts.length / 2)];
  return [text.slice(0, cut), text.slice(cut)];
}
