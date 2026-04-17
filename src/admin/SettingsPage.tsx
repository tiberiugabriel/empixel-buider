import React, { useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type Collection = { slug: string; label: string };

export function SettingsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/_emdash/api/schema/collections")
        .then((r) => parseApiResponse<{ items: Collection[] }>(r, "Failed to load collections")),
      apiFetch("/_emdash/api/plugins/empixel-builder/collections")
        .then((r) => parseApiResponse<{ data: string[] }>(r, "Failed to load enabled")),
    ])
      .then(([{ items }, { data }]) => {
        setCollections(items ?? []);
        setEnabled(new Set(data ?? []));
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(slug: string, checked: boolean) {
    setToggling((prev) => new Set(prev).add(slug));
    try {
      const res = await apiFetch("/_emdash/api/plugins/empixel-builder/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: slug, enabled: checked }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setEnabled((prev) => {
        const next = new Set(prev);
        checked ? next.add(slug) : next.delete(slug);
        return next;
      });
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  }

  return (
    <div className="epx-settings">
      <div className="epx-settings__header">
        <span className="epx-topbar__logo">⚡ EmPixel Builder — Settings</span>
        <p className="epx-settings__subtitle">
          Enable the builder on a content type to allow visual page editing.
          Layouts are stored in a dedicated table and do not affect the collection schema.
        </p>
      </div>

      <div className="epx-settings__body">
        {loading && <div className="epx-selector__loading"><div className="epx-spinner" />Loading…</div>}
        {error && <p className="epx-settings__message epx-settings__message--error">{error}</p>}

        {!loading && !error && (
          <section className="epx-settings__section">
            <h2 className="epx-settings__section-title">Content Types</h2>
            {collections.length === 0 && (
              <p className="epx-selector__empty">No content types found.</p>
            )}
            {collections.map(({ slug, label }) => {
              const isEnabled = enabled.has(slug);
              const isBusy = toggling.has(slug);
              return (
                <label key={slug} className={`epx-settings__row${isBusy ? " is-busy" : ""}`}>
                  <input
                    className="epx-settings__checkbox"
                    type="checkbox"
                    checked={isEnabled}
                    disabled={isBusy}
                    onChange={(e) => handleToggle(slug, e.target.checked)}
                  />
                  <span className="epx-settings__col-label">{label}</span>
                  <span className="epx-settings__col-slug">{slug}</span>
                  {isBusy && <div className="epx-spinner epx-spinner--sm" />}
                </label>
              );
            })}
          </section>
        )}
      </div>

      <style>{`
        .epx-settings {
          min-height: 100vh;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .epx-settings__header {
          background: #fff;
          border-bottom: 1px solid #e0e0e0;
          padding: 32px 40px 24px;
        }
        .epx-settings__subtitle {
          color: #888;
          font-size: 14px;
          margin: 6px 0 0;
        }
        .epx-settings__body {
          padding: 32px 40px;
          max-width: 600px;
        }
        .epx-settings__section {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }
        .epx-settings__section-title {
          font-size: 11px;
          font-weight: 700;
          color: #888;
          margin: 0;
          padding: 12px 16px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid #f0f0f0;
        }
        .epx-settings__row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid #f5f5f5;
          cursor: pointer;
          transition: background 0.1s;
        }
        .epx-settings__row:last-child { border-bottom: none; }
        .epx-settings__row:hover { background: #fafafa; }
        .epx-settings__row.is-busy { opacity: 0.6; cursor: wait; }
        .epx-settings__checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: #2563eb;
          flex-shrink: 0;
        }
        .epx-settings__col-label {
          font-size: 14px;
          font-weight: 500;
          color: #111;
          flex: 1;
        }
        .epx-settings__col-slug {
          font-size: 12px;
          color: #aaa;
          font-family: monospace;
        }
        .epx-spinner--sm {
          width: 14px;
          height: 14px;
          border-width: 2px;
          flex-shrink: 0;
        }
        .epx-settings__message {
          font-size: 13px;
          color: #22c55e;
          padding: 10px 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          margin-bottom: 16px;
        }
        .epx-settings__message--error {
          color: #ef4444;
          background: #fef2f2;
          border-color: #fecaca;
        }
      `}</style>
    </div>
  );
}
