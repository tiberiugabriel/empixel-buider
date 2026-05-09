import React, { memo } from "react";

// Whitelist of tags Text.astro accepts. Anything outside this list falls
// back to the default `<p>` so a corrupted/legacy config can't render an
// arbitrary HTML element on canvas.
const ALLOWED_TAGS = new Set([
  "p", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
]);

export const TextPreview = memo(function TextPreview({ config }: { config: Record<string, unknown> }) {
  const content = (config.content as string) || "";
  const htmlTagRaw = (config.htmlTag as string) || "p";
  const Tag = (ALLOWED_TAGS.has(htmlTagRaw) ? htmlTagRaw : "p") as keyof React.JSX.IntrinsicElements;

  if (!content) {
    return (
      <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Text block</span>
    );
  }
  // Mirror Text.astro's root tag (`<Tag(htmlTag)>{content}</Tag>`). Canvas
  // wraps the preview in `<div data-epx-block="<id>">`, so the chrome CSS
  // emitted by `buildBlockChromeCss` targets that outer div — the inner
  // tag here is purely about typography defaults (heading sizes, paragraph
  // margins). Inline `margin: 0` neutralises browser-default margins so
  // spacing comes only from the author's configured padding/margin.
  return (
    <Tag style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</Tag>
  );
});
