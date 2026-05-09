import React, { memo, useEffect, useId, useRef, useState } from "react";

interface PreviewProps {
  config: Record<string, unknown>;
}

// F4.8 — inline measure script that runs INSIDE the iframe and posts
// document.documentElement.scrollHeight to the canvas (parent) on load /
// resize / MutationObserver content changes. Mirrors the protocol shipped
// in Html.astro so author preview behaves identically to runtime. Replaces
// the v0.6 DOM-polling auto-resize that required `allow-same-origin`.
function buildMeasureScript(id: string): string {
  const idJson = JSON.stringify(id);
  return [
    "<script>",
    "(function(){",
    "function send(){",
    "try{",
    "var h=document.documentElement.scrollHeight;",
    `parent.postMessage({type:"epx:html:resize",height:h,id:${idJson}},"*");`,
    "}catch(e){}",
    "}",
    'window.addEventListener("load",send);',
    'window.addEventListener("resize",send);',
    'if(document.body){new MutationObserver(send).observe(document.body,{subtree:true,childList:true,characterData:true});}',
    "send();",
    "})();",
    "</script>",
  ].join("");
}

function buildSrcdoc(code: string, id: string): string {
  const measureScript = buildMeasureScript(id);
  const hasFullDoc = /<html[\s>]/i.test(code);
  if (hasFullDoc) {
    if (/<\/body>/i.test(code)) {
      return code.replace(/<\/body>/i, `${measureScript}</body>`);
    }
    return `${code}${measureScript}`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;}</style></head><body>${code}${measureScript}</body></html>`;
}

export const HtmlPreview = memo(function HtmlPreview({ config }: PreviewProps) {
  const code = (config.code as string) || "";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const frameId = useId();

  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return;

    // F4.8 — postMessage listener. Mirrors Html.astro's parent script.
    // Match by `e.source === f.contentWindow` (canonical — the iframe's
    // origin is "null" under `sandbox="allow-scripts"` so origin checks
    // can't disambiguate iframes; contentWindow refs are unique).
    const onMessage = (e: MessageEvent) => {
      if (e.source !== f.contentWindow) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      const msg = data as { type?: unknown; height?: unknown };
      if (msg.type !== "epx:html:resize") return;
      const h = msg.height;
      if (typeof h !== "number" || !isFinite(h) || h <= 0) return;
      f.style.height = `${h}px`;
      setHeight(h);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [code]);

  if (!code.trim()) {
    return <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>HTML block</span>;
  }

  // Mirror Html.astro's iframe override CSS: `display:block; width:100%;
  // border:none; box-sizing:border-box`. The frontend's `flex:1 1 100%`
  // and `align-self:stretch` are no-ops here because the canvas wraps
  // every preview in a `display:block` `epx-canvas-block-host` rather
  // than a flex/grid parent — but matching `box-sizing` keeps the iframe
  // consistent with the host page layout when the user copies the block
  // back into a flex/grid container at runtime.
  //
  // F4.8 — sandbox tightened to `allow-scripts` only (no `allow-same-origin`).
  // The auto-resize protocol no longer requires reading the iframe's
  // contentDocument from the parent, so untrusted HTML loses access to
  // parent.document / parent.location entirely.
  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      scrolling="no"
      srcDoc={buildSrcdoc(code, frameId)}
      data-epx-html-frame={frameId}
      style={{
        display: "block",
        width: "100%",
        height: height || 0,
        border: 0,
        boxSizing: "border-box",
      }}
    />
  );
});
