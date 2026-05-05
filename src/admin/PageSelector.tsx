import { useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { Entry } from "./builder/builderReducer.js";
import { ToastContainer, type ToastMsg } from "./components/ToastContainer.js";

type CollectionTab = { slug: string; label: string };

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts.endsWith("Z") ? ts : ts + "Z");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

let _toastId = 0;

export function PageSelector({ onSelect }: { onSelect: (id: string, title: string, collection: string) => void }) {
  const [collections, setCollections] = useState<CollectionTab[]>([]);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [collection, setCollection] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  function addToast(msg: Omit<ToastMsg, "id">) {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { ...msg, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }

  // Load enabled collections from plugin
  useEffect(() => {
    apiFetch("/_emdash/api/plugins/empixel-builder/collections")
      .then((res) => parseApiResponse<{ data: string[] }>(res, "Failed to load collections"))
      .then(({ data }) => {
        const tabs = (data ?? []).map((slug) => ({
          slug,
          label: slug.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        }));
        setCollections(tabs);
        if (tabs.length > 0) setCollection(tabs[0].slug);
      })
      .catch((err: unknown) => {
        console.error("[empixel-builder] collections error:", err);
        setCollectionsError(String(err));
      });
  }, []);

  useEffect(() => {
    if (!collection) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch(`/_emdash/api/plugins/empixel-builder/entries?collection=${collection}`)
      .then((res) => parseApiResponse<{ data: Entry[] }>(res, "Failed to load entries"))
      .then(({ data }) => {
        setEntries(data ?? []);
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [collection]);

  async function handleToggleEntry(entry: Entry, checked: boolean) {
    setToggling((prev) => new Set(prev).add(entry.id));
    try {
      const res = await apiFetch("/_emdash/api/plugins/empixel-builder/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, collection, enabled: checked }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, builder_enabled: checked } : e));
      addToast({ message: checked ? "Builder enabled" : "Builder disabled", kind: "success" });
    } catch {
      addToast({ message: "Failed to update builder status", kind: "error" });
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(entry.id); return s; });
    }
  }

  return (
    <div className="epx-selector">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      <div className="epx-selector__header">
        <div className="epx-selector__header-top">
          <span className="epx-topbar__logo">EmPixel Builder</span>
          <a className="epx-selector__settings-link" href="/_emdash/admin/plugins/empixel-builder/settings">⚙ Settings</a>
        </div>
        <p className="epx-selector__subtitle">Select a page or post to edit its layout</p>
        {collections.length > 0 && (
          <div className="epx-selector__tabs">
            {collections.map((c) => (
              <button
                key={c.slug}
                className={`epx-selector__tab${collection === c.slug ? " is-active" : ""}`}
                onClick={() => setCollection(c.slug)}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="epx-selector__body">
        {collectionsError && (
          <p className="epx-error">Collections error: {collectionsError}</p>
        )}
        {!collectionsError && collections.length === 0 && (
          <p className="epx-selector__empty">
            No collections enabled. Go to <a href="/_emdash/admin/plugins/empixel-builder/settings">Settings</a> to enable the builder on a collection.
          </p>
        )}
        {collections.length > 0 && loading && <div className="epx-selector__loading"><div className="epx-spinner" />Loading…</div>}
        {collections.length > 0 && error && <p className="epx-error">Error: {error}</p>}
        {collections.length > 0 && !loading && !error && entries.length === 0 && (
          <p className="epx-selector__empty">No entries found in "{collection}".</p>
        )}
        {collections.length > 0 && !loading && !error && entries.length > 0 && (
          <div className="epx-selector__table-wrap"><table className="epx-selector__table">
            <thead>
              <tr>
                <th className="epx-selector__th">Name &amp; ID</th>
                <th className="epx-selector__th">Date created</th>
                <th className="epx-selector__th">Last modified</th>
                <th className="epx-selector__th epx-selector__th--center">Enable Builder</th>
                <th className="epx-selector__th epx-selector__th--center">View</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="epx-selector__row">
                  <td
                    className="epx-selector__td epx-selector__td--name"
                    onClick={() => onSelect(entry.id, entry.title, collection)}
                  >
                    <span className="epx-selector__entry-title">{entry.title}</span>
                    <span className="epx-selector__entry-id">{entry.id}</span>
                  </td>
                  <td className="epx-selector__td">{formatDate(entry.created_at)}</td>
                  <td className="epx-selector__td">{formatDate(entry.updated_at)}</td>
                  <td className="epx-selector__td epx-selector__td--center">
                    <input
                      type="checkbox"
                      className="epx-selector__toggle"
                      checked={entry.builder_enabled}
                      disabled={toggling.has(entry.id)}
                      onChange={(e) => handleToggleEntry(entry, e.currentTarget.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="epx-selector__td epx-selector__td--center">
                    <a
                      className="epx-selector__view-link"
                      href={`/${collection}/${entry.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="View page"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 256 256" fill="currentColor">
                        <path d="M224,104a8,8,0,0,1-16,0V59.32l-82.34,82.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z" />
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
