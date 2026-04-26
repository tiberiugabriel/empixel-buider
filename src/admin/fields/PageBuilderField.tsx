import React, { useEffect, useState } from "react";
import { apiFetch } from "emdash/plugin-utils";

interface Props {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
  id?: string;
  required?: boolean;
  options?: Record<string, unknown>;
  minimal?: boolean;
}

function getEntryContext(): { collection: string; id: string } | null {
  const match = window.location.pathname.match(/\/content\/([^/]+)\/([^/?#]+)/);
  return match ? { collection: match[1], id: decodeURIComponent(match[2]) } : null;
}

export function PageBuilderField({ value, onChange, minimal }: Props) {
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const ctx = getEntryContext();
  const enabled = !!value;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!ctx || !enabled) { setSectionCount(null); return; }
    apiFetch(
      `/_emdash/api/plugins/empixel-builder/layout?pageId=${encodeURIComponent(ctx.id)}&collection=${encodeURIComponent(ctx.collection)}`
    )
      .then((r) => r.json())
      .then(({ data }: { data?: { sections?: unknown[] } }) => {
        setSectionCount(data?.sections?.length ?? 0);
      })
      .catch(() => setSectionCount(0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.id, ctx?.collection, enabled]);

  const openBuilder = () => {
    if (!ctx) return;
    const back = window.location.pathname + window.location.search;
    window.location.href =
      `/_emdash/admin/plugins/empixel-builder/editor` +
      `?pageId=${encodeURIComponent(ctx.id)}` +
      `&collection=${encodeURIComponent(ctx.collection)}` +
      `&back=${encodeURIComponent(back)}`;
  };

  if (!ctx) {
    return <div className="epx-fw-error">Could not determine entry from URL.</div>;
  }

  const countLabel =
    sectionCount === null
      ? ""
      : sectionCount === 0
      ? "No sections yet — start building"
      : `${sectionCount} section${sectionCount !== 1 ? "s" : ""}`;

  return (
    <div className={`epx-fw${minimal ? " epx-fw--minimal" : ""}${enabled ? " is-enabled" : ""}`}>
      <div className="epx-fw__icon">⚡</div>
      <div className="epx-fw__body">
        <p className="epx-fw__title">EmPixel Builder</p>
        {enabled && countLabel && <p className="epx-fw__count">{countLabel}</p>}
      </div>
      <div className="epx-fw__actions">
        <label className="epx-fw__toggle" title={enabled ? "Disable builder" : "Enable builder"}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="epx-fw__toggle-track">
            <span className="epx-fw__toggle-thumb" />
          </span>
        </label>
        {enabled && (
          <button className="epx-fw__btn" onClick={openBuilder} type="button">
            Open Builder
          </button>
        )}
      </div>
      <style>{`
        .epx-fw {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #f8faff;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          transition: border-color 0.15s, background 0.15s;
        }
        .epx-fw.is-enabled {
          background: linear-gradient(135deg, #eff6ff 0%, #f0f4ff 100%);
          border-color: #bfdbfe;
        }
        .epx-fw--minimal { padding: 8px 12px; border-radius: 6px; }
        .epx-fw__icon { font-size: 22px; flex-shrink: 0; line-height: 1; }
        .epx-fw__body { flex: 1; min-width: 0; }
        .epx-fw__title { margin: 0 0 2px; font-size: 13px; font-weight: 700; color: #1e3a8a; }
        .epx-fw__count { margin: 0; font-size: 12px; color: #64748b; }
        .epx-fw__actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .epx-fw__toggle { position: relative; display: inline-flex; cursor: pointer; }
        .epx-fw__toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
        .epx-fw__toggle-track {
          display: flex;
          align-items: center;
          width: 36px;
          height: 20px;
          border-radius: 10px;
          background: #cbd5e1;
          transition: background 0.2s;
          padding: 2px;
          box-sizing: border-box;
        }
        .epx-fw__toggle input:checked + .epx-fw__toggle-track { background: #2563eb; }
        .epx-fw__toggle-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          flex-shrink: 0;
        }
        .epx-fw__toggle input:checked + .epx-fw__toggle-track .epx-fw__toggle-thumb {
          transform: translateX(16px);
        }
        .epx-fw__btn {
          padding: 7px 16px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .epx-fw__btn:hover { background: #1d4ed8; }
        .epx-fw-error { font-size: 13px; color: #ef4444; }
      `}</style>
    </div>
  );
}
