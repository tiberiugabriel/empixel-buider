import React from "react";

export function IconThemeLight() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6.5" cy="6.5" r="2.5" fill="currentColor"/>
      <line x1="6.5" y1="0.5" x2="6.5" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6.5" y1="11" x2="6.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="0.5" y1="6.5" x2="2" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="11" y1="6.5" x2="12.5" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="2.4" y1="2.4" x2="3.4" y2="3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9.6" y1="9.6" x2="10.6" y2="10.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="10.6" y1="2.4" x2="9.6" y2="3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="3.4" y1="9.6" x2="2.4" y2="10.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function IconThemeDark() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 2C4.015 2 2 4.015 2 6.5C2 8.985 4.015 11 6.5 11C8.3 11 9.86 9.96 10.6 8.45C10.1 8.64 9.56 8.75 9 8.75C6.929 8.75 5.25 7.071 5.25 5C5.25 4.07 5.59 3.22 6.16 2.57C6.27 2.39 6.38 2.2 6.5 2Z" fill="currentColor"/>
    </svg>
  );
}

export function getThemeStyleKey(theme: string): "style" | "styleDark" {
  return theme === "dark" ? "styleDark" : "style";
}

interface ThemeStyleToggleProps {
  theme: string;
  onChange: (theme: string) => void;
}

export function ThemeStyleToggle({ theme, onChange }: ThemeStyleToggleProps) {
  return (
    <div className="epx-blk-theme-toggle">
      <button
        type="button"
        className={theme === "light" ? "is-active" : undefined}
        onClick={() => onChange("light")}
        data-tooltip="Light"
      >
        <IconThemeLight />
      </button>
      <button
        type="button"
        className={theme === "dark" ? "is-active" : undefined}
        onClick={() => onChange("dark")}
        data-tooltip="Dark"
      >
        <IconThemeDark />
      </button>
    </div>
  );
}
