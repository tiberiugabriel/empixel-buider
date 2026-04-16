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

/** Extract the entry ID from the current admin URL.
 *  Pattern: /_emdash/admin/content/{collection}/{id}
 */
function getEntryIdFromUrl(): string | null {
  const match = window.location.pathname.match(/\/content\/[^/]+\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function PageBuilderField({ minimal }: Props) {
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const entryId = getEntryIdFromUrl();

  useEffect(() => {
    if (!entryId) { setLoading(false); return; }
    apiFetch(`/_emdash/api/plugins/empixel-builder/layout?pageId=${encodeURIComponent(entryId)}`)
      .then((r) => r.json())
      .then(({ data }: { data?: { sections?: unknown[] } }) => {
        setSectionCount(data?.sections?.length ?? 0);
      })
      .catch(() => setSectionCount(0))
      .finally(() => setLoading(false));
  }, [entryId]);

  const openBuilder = () => {
    if (!entryId) return;
    const back = window.location.pathname + window.location.search;
    window.location.href =
      `/_emdash/admin/plugins/empixel-builder/editor` +
      `?pageId=${encodeURIComponent(entryId)}` +
      `&back=${encodeURIComponent(back)}`;
  };

  if (!entryId) {
    return (
      <div className="epx-fw-error">
        Could not determine entry ID from URL.
      </div>
    );
  }

  const countLabel = loading
    ? "Loading…"
    : sectionCount === 0
    ? "No sections yet — start building"
    : `${sectionCount} section${sectionCount !== 1 ? "s" : ""}`;

  return (
    <div className={`epx-fw${minimal ? " epx-fw--minimal" : ""}`}>
      <div className="epx-fw__icon">⚡</div>
      <div className="epx-fw__body">
        <p className="epx-fw__title">EmPixel Builder</p>
        <p className="epx-fw__count">{countLabel}</p>
      </div>
      <button className="epx-fw__btn" onClick={openBuilder} type="button">
        Open Builder
      </button>
      <style>{`
        .epx-fw {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: linear-gradient(135deg, #eff6ff 0%, #f0f4ff 100%);
          border: 1.5px solid #bfdbfe;
          border-radius: 10px;
        }
        .epx-fw--minimal { padding: 8px 12px; border-radius: 6px; }
        .epx-fw__icon { font-size: 22px; flex-shrink: 0; }
        .epx-fw__body { flex: 1; min-width: 0; }
        .epx-fw__title { margin: 0 0 2px; font-size: 13px; font-weight: 700; color: #1e3a8a; }
        .epx-fw__count { margin: 0; font-size: 12px; color: #64748b; }
        .epx-fw__btn {
          padding: 8px 20px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .epx-fw__btn:hover { background: #1d4ed8; }
        .epx-fw-error { font-size: 13px; color: #ef4444; }
      `}</style>
    </div>
  );
}
