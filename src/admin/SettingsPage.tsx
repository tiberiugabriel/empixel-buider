import React, { useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

const LAYOUT_FIELD = {
  slug: "layout",
  type: "json",
  label: "Builder Layout",
  widget: "hidden",
};

type Status = "idle" | "loading" | "saving" | "error";

export function SettingsPage() {
  const [enabled, setEnabled] = useState<string[]>([]);
  const [newSlug, setNewSlug] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus("loading");
    apiFetch("/_emdash/api/plugins/empixel-builder/collections")
      .then((res) => parseApiResponse<{ data: string[] }>(res, "Failed to load collections"))
      .then(({ data }) => {
        setEnabled(data ?? []);
        setStatus("idle");
      })
      .catch((err: unknown) => {
        setMessage(String(err));
        setStatus("error");
      });
  }, []);

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    const slug = newSlug.trim().toLowerCase();
    if (!slug || enabled.includes(slug)) return;

    setStatus("saving");
    setMessage(null);

    try {
      // Add the layout field to the collection via schema API
      const fieldRes = await apiFetch(
        `/_emdash/api/schema/collections/${encodeURIComponent(slug)}/fields`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(LAYOUT_FIELD),
        }
      );
      // 409 Conflict = field already exists, that's OK
      if (!fieldRes.ok && fieldRes.status !== 409) {
        const text = await fieldRes.text();
        throw new Error(`Schema API error: ${text}`);
      }

      // Save enabled state in plugin kv
      const settingsRes = await apiFetch("/_emdash/api/plugins/empixel-builder/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: slug, enabled: true }),
      });
      if (!settingsRes.ok) throw new Error("Failed to save settings");

      setEnabled((prev) => [...prev, slug]);
      setNewSlug("");
      setMessage(`Builder enabled for "${slug}".`);
      setStatus("idle");
    } catch (err: unknown) {
      setMessage(String(err));
      setStatus("error");
    }
  }

  async function handleDisable(slug: string) {
    setStatus("saving");
    setMessage(null);
    try {
      const res = await apiFetch("/_emdash/api/plugins/empixel-builder/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: slug, enabled: false }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setEnabled((prev) => prev.filter((c) => c !== slug));
      setMessage(`Builder disabled for "${slug}". The layout field and data are preserved.`);
      setStatus("idle");
    } catch (err: unknown) {
      setMessage(String(err));
      setStatus("error");
    }
  }

  return (
    <div className="epx-settings">
      <div className="epx-settings__header">
        <span className="epx-topbar__logo">⚡ EmPixel Builder — Settings</span>
        <p className="epx-settings__subtitle">
          Enable the builder for a collection to add a <code>layout</code> field and allow visual editing.
        </p>
      </div>

      <div className="epx-settings__body">
        <section className="epx-settings__section">
          <h2 className="epx-settings__section-title">Enabled Collections</h2>
          {status === "loading" && (
            <div className="epx-selector__loading"><div className="epx-spinner" />Loading…</div>
          )}
          {enabled.length === 0 && status !== "loading" && (
            <p className="epx-selector__empty">No collections enabled yet.</p>
          )}
          {enabled.map((slug) => (
            <div key={slug} className="epx-settings__row">
              <span className="epx-settings__collection-slug">{slug}</span>
              <button
                className="epx-btn epx-btn--ghost epx-btn--sm"
                onClick={() => handleDisable(slug)}
                disabled={status === "saving"}
                type="button"
              >
                Disable
              </button>
            </div>
          ))}
        </section>

        <section className="epx-settings__section">
          <h2 className="epx-settings__section-title">Enable Builder for a Collection</h2>
          <form className="epx-settings__form" onSubmit={handleEnable}>
            <input
              className="epx-field__input"
              type="text"
              placeholder="Collection slug (e.g. pages)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              disabled={status === "saving"}
            />
            <button
              className="epx-btn epx-btn--primary"
              type="submit"
              disabled={status === "saving" || !newSlug.trim()}
            >
              {status === "saving" ? "Enabling…" : "Enable"}
            </button>
          </form>
          <p className="epx-settings__hint">
            This adds a hidden <code>layout</code> JSON field to the collection schema.
          </p>
        </section>

        {message && (
          <p className={`epx-settings__message${status === "error" ? " epx-settings__message--error" : ""}`}>
            {message}
          </p>
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
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .epx-settings__section {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .epx-settings__section-title {
          font-size: 13px;
          font-weight: 700;
          color: #444;
          margin: 0 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .epx-settings__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f8f8f8;
          border: 1px solid #e8e8e8;
          border-radius: 6px;
        }
        .epx-settings__collection-slug {
          font-size: 14px;
          font-weight: 500;
          font-family: monospace;
          color: #222;
        }
        .epx-btn--sm { padding: 4px 12px; font-size: 13px; }
        .epx-settings__form {
          display: flex;
          gap: 8px;
        }
        .epx-settings__form .epx-field__input {
          flex: 1;
        }
        .epx-settings__hint {
          font-size: 12px;
          color: #999;
          margin: 0;
        }
        .epx-settings__hint code {
          font-family: monospace;
          background: #f0f0f0;
          padding: 1px 4px;
          border-radius: 3px;
        }
        .epx-settings__message {
          font-size: 13px;
          color: #22c55e;
          padding: 10px 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
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
