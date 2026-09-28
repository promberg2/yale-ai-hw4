const SWATCHES: [RegExp, string][] = [
  [/royal blue/, "#2a52be"],
  [/light blue/, "#9cc3e6"],
  [/navy/, "#14264a"],
  [/blue/, "#286dc0"],
  [/charcoal/, "#3c4046"],
  [/dark heather/, "#55595f"],
  [/light (gray|steel)/, "#d4d6d8"],
  [/heather|gray|grey/, "#a9adb2"],
  [/coral/, "#e28a7a"],
  [/red/, "#b1252f"],
  [/green/, "#2f6b3f"],
  [/yellow/, "#e8c43a"],
  [/gold/, "#c6a052"],
  [/black/, "#16181b"],
  [/ivory|cream|natural/, "#f1e9d6"],
  [/white/, "#ffffff"],
];

export function swatch(color: string): string {
  const c = color.toLowerCase();
  if (c.includes("multicolor")) {
    return "conic-gradient(#b1252f, #e8c43a, #2f6b3f, #286dc0, #b1252f)";
  }
  for (const [pattern, hex] of SWATCHES) {
    if (pattern.test(c)) return hex;
  }
  return "#c9ccd1";
}

export function titleCase(text: string): string {
  return text.replace(/\b\w/g, (m) => m.toUpperCase());
}
