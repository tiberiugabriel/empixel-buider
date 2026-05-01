type GradStop = { color: string; alpha: number; pos: number };

function getEffectiveStyle(config: Record<string, unknown>): Record<string, unknown> {
  const style = (config.style ?? {}) as Record<string, unknown>;
  if ((config.theme as string) === "dark") {
    const styleDark = (config.styleDark ?? {}) as Record<string, unknown>;
    return { ...style, ...styleDark };
  }
  return style;
}

function hexToRgba(hex: string, alpha: number): string {
  const c    = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map(x => x + x).join("") : c.slice(0, 6);
  const n    = parseInt(full.padEnd(6, "0"), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function camelToKebab(s: string): string {
  return s.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`);
}

function cssStr(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const t = v.trim();
  if (t.startsWith("@@")) return t.slice(2); // custom CSS value marker
  return t;
}

// ─── Background ───────────────────────────────────────────────────────────────

export function buildBackgroundCss(style: Record<string, unknown>): string {
  const type = style.backgroundType as string | undefined;
  if (!type) return "";

  if (type === "color") {
    const color = (style.backgroundColor as string) ?? "#ffffff";
    const alpha = (style.backgroundColorAlpha as number) ?? 1;
    return `background:${hexToRgba(color, alpha)};`;
  }

  if (type === "gradient") {
    const angle = (style.backgroundGradAngle as number) ?? 135;
    let stops: GradStop[] = [];
    try { stops = JSON.parse((style.backgroundGradStops as string) ?? "[]"); } catch { /**/ }
    if (stops.length < 2) return "";
    const parts = [...stops]
      .sort((a, b) => a.pos - b.pos)
      .map(s => `${hexToRgba(s.color, s.alpha)} ${s.pos}%`)
      .join(",");
    return `background:linear-gradient(${angle}deg,${parts});`;
  }

  if (type === "image") {
    const src    = style.backgroundImageSrc as string | undefined;
    const imgUrl = src === "url"
      ? (style.backgroundImageUrl as string | undefined)
      : (() => { const k = style.backgroundImageStorageKey as string | undefined; return k ? `/_emdash/api/media/file/${k}` : undefined; })();
    if (!imgUrl) return "";
    const size       = (style.backgroundImageSize       as string) || "cover";
    const position   = (style.backgroundImagePosition   as string) || "center";
    const repeat     = (style.backgroundImageRepeat     as string) || "no-repeat";
    const attachment = (style.backgroundImageAttachment as string) || "";
    return [
      `background-image:url(${imgUrl})`,
      `background-size:${size}`,
      `background-position:${position}`,
      `background-repeat:${repeat}`,
      ...(attachment && attachment !== "scroll" ? [`background-attachment:${attachment}`] : []),
    ].join(";") + ";";
  }

  if (type === "slideshow") {
    let slides: Array<{ storageKey?: string }> = [];
    try { slides = JSON.parse((style.backgroundSlides as string) ?? "[]"); } catch { /**/ }
    const first = slides[0];
    if (first?.storageKey)
      return `background:url(/_emdash/api/media/file/${first.storageKey}) center/cover no-repeat;`;
  }

  // video: handled via <video> element overlay — no CSS background
  return "";
}

// ─── Full inline style string ─────────────────────────────────────────────────

const STYLE_PROPS = [
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop",  "marginRight",  "marginBottom",  "marginLeft",
  "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight",
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "overflowX", "overflowY",
] as const;

export function buildBlockStyle(config: Record<string, unknown>): string {
  const style    = getEffectiveStyle(config);
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;

  const parts: string[] = [];

  // Background
  const bg = buildBackgroundCss(style);
  if (bg) parts.push(bg.replace(/;$/, ""));

  // Border style + color (applied together when borderStyle is not "none")
  const borderSt = cssStr(style.borderStyle);
  if (borderSt && borderSt !== "none") {
    const color = (style.borderColor as string) ?? "#000000";
    const alpha = (style.borderAlpha as number) ?? 1;
    parts.push(`border-style:${borderSt}`);
    parts.push(`border-color:${hexToRgba(color, alpha)}`);
  }

  // All simple camelCase → kebab CSS properties
  for (const prop of STYLE_PROPS) {
    const v = cssStr(style[prop]);
    if (v) parts.push(`${camelToKebab(prop)}:${v}`);
  }

  // Advanced: position + inset
  const pos = cssStr(advanced.position);
  if (pos) {
    parts.push(`position:${pos}`);
    for (const side of ["top", "right", "bottom", "left"]) {
      const v = cssStr(advanced[side]);
      if (v) parts.push(`${side}:${v}`);
    }
  }

  // Advanced: z-index
  const zi = advanced.zIndex;
  if (zi !== undefined && zi !== "" && zi !== null) parts.push(`z-index:${zi}`);

  return parts.join(";");
}

// ─── Video background: storage key or URL ────────────────────────────────────

export function getVideoBackground(config: Record<string, unknown>): string | null {
  const style = getEffectiveStyle(config);
  if (style.backgroundType !== "video") return null;

  const src = style.backgroundVideoSrc as string | undefined;
  if (src === "url") return (style.backgroundVideoUrl as string) ?? null;

  const key = style.backgroundVideoMediaStorageKey as string | undefined;
  return key ? `/_emdash/api/media/file/${key}` : null;
}

// ─── Hover CSS ────────────────────────────────────────────────────────────────

const HOVER_STYLE_PROPS = [
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const;

export function buildHoverCss(config: Record<string, unknown>, blockId: string): string {
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  // Background
  const bg = buildBackgroundCss(styleHover);
  if (bg) parts.push(bg.replace(/;$/, "") + " !important");

  // Border style + color
  const borderSt = cssStr(styleHover.borderStyle);
  if (borderSt && borderSt !== "none") {
    const color = (styleHover.borderColor as string) ?? "#000000";
    const alpha = (styleHover.borderAlpha as number) ?? 1;
    parts.push(`border-style:${borderSt} !important`);
    parts.push(`border-color:${hexToRgba(color, alpha)} !important`);
  }

  // Border widths + radius
  for (const prop of HOVER_STYLE_PROPS) {
    const v = cssStr(styleHover[prop]);
    if (v) parts.push(`${camelToKebab(prop)}:${v} !important`);
  }

  if (!parts.length) return "";
  return `[data-epx-block="${blockId}"]:hover{${parts.join(";")}}`;
}

// ─── HTML attribute helpers ───────────────────────────────────────────────────

export function getBlockId(config: Record<string, unknown>): string | null {
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  return cssStr(advanced.cssId) || null;
}

export function getBlockClass(config: Record<string, unknown>): string {
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  return cssStr(advanced.cssClasses);
}

export function getCustomCss(config: Record<string, unknown>, blockId: string): string {
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  const css = cssStr(advanced.customCss);
  if (!css) return "";
  return `[data-epx-block="${blockId}"]{${css}}`;
}
