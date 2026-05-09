import React from "react";
import type { BackgroundType } from "./serialize.js";

/**
 * Type-tab strip for `BackgroundControl`. Five `<button>`s, one per
 * `BackgroundType`, each with an inline SVG icon. Extracted in F4.7
 * to keep `BackgroundControl.tsx` under the 200-LOC target — these
 * icons are large enough that inlining them in the dispatcher pushed
 * the file over budget.
 */
function IconColor()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor"/></svg>; }
function IconGradient()  {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <defs>
        <linearGradient id="epx-ig" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="currentColor"/>
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="12" height="12" rx="2" fill="url(#epx-ig)"/>
    </svg>
  );
}
function IconImage()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="4.5" r="1.2" fill="currentColor"/><path d="M1.5 9.5l3-3 2 2 2.5-3 3 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>; }
function IconVideo()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 4.5l4 2.5-4 2.5V4.5z" fill="currentColor"/></svg>; }
function IconSlideshow() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="0.5" y="3.5" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="3.5" y="1" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" fill="none"/></svg>; }

const TYPE_TABS: { type: BackgroundType; icon: React.ReactNode; title: string }[] = [
  { type: "color",     icon: <IconColor />,     title: "Solid Color" },
  { type: "gradient",  icon: <IconGradient />,  title: "Gradient" },
  { type: "image",     icon: <IconImage />,     title: "Image" },
  { type: "video",     icon: <IconVideo />,     title: "Video" },
  { type: "slideshow", icon: <IconSlideshow />, title: "Slideshow" },
];

interface Props {
  active: BackgroundType | undefined;
  allowedTypes?: BackgroundType[];
  onSelect: (t: BackgroundType) => void;
}

export function TypeTabs({ active, allowedTypes, onSelect }: Props) {
  const tabs = allowedTypes ? TYPE_TABS.filter(t => allowedTypes.includes(t.type)) : TYPE_TABS;
  return (
    <div className="epx-bg-ctrl__type-tabs">
      {tabs.map(tab => (
        <button
          key={tab.type}
          type="button"
          className={`epx-bg-ctrl__type-tab${active === tab.type ? " is-active" : ""}`}
          onClick={() => onSelect(tab.type)}
          data-tooltip={tab.title}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
}
