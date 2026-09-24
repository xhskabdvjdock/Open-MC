// Minecraft formatting codes (§) → HTML preview. Supports colors + bold/italic/underline/strikethrough/obfuscated.
const COLORS: Record<string, string> = {
  "0": "#000000", "1": "#0000AA", "2": "#00AA00", "3": "#00AAAA",
  "4": "#AA0000", "5": "#AA00AA", "6": "#FFAA00", "7": "#AAAAAA",
  "8": "#555555", "9": "#5555FF", "a": "#55FF55", "b": "#55FFFF",
  "c": "#FF5555", "d": "#FF55FF", "e": "#FFFF55", "f": "#FFFFFF",
  "g": "#DDD605",
};

export function motdToHtml(input: string): string {
  let html = "";
  let color = "#FFFFFF";
  let bold = false, italic = false, underline = false, strike = false;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let buf = "";
  const flush = () => {
    if (!buf) return;
    const style = `color:${color};${bold ? "font-weight:bold;" : ""}${italic ? "font-style:italic;" : ""}${underline || strike ? `text-decoration:${[underline ? "underline" : "", strike ? "line-through" : ""].filter(Boolean).join(" ")};` : ""}`;
    // obfuscated handled client-side via CSS class swapping; here render as-is
    html += `<span style="${style}">${esc(buf)}</span>`;
    buf = "";
  };
  // Support both § and & codes
  const normalized = input.replace(/&([0-9a-gk-or])/gi, "§$1");
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c === "§" && i + 1 < normalized.length) {
      const code = normalized[i + 1].toLowerCase();
      i++;
      if (COLORS[code]) { flush(); color = COLORS[code]; }
      else if (code === "l") { flush(); bold = true; }
      else if (code === "o") { flush(); italic = true; }
      else if (code === "n") { flush(); underline = true; }
      else if (code === "m") { flush(); strike = true; }
      else if (code === "r") { flush(); color = "#FFFFFF"; bold = italic = underline = strike = false; }
      else if (code === "k") { buf += "▓"; } // obfuscated placeholder (honest: can't reproduce exactly)
      continue;
    }
    if (c === "\n") { flush(); html += "<br/>"; continue; }
    buf += c;
  }
  flush();
  return html || `<span style="color:#888">Empty MOTD</span>`;
}

export const MOTD_COLOR_BUTTONS = Object.entries(COLORS).map(([code, hex]) => ({ code, hex }));
