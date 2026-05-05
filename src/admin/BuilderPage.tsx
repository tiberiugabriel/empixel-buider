import { useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { Builder } from "./builder/Builder.js";
import { BuilderStyles } from "./builder/BuilderStyles.js";
import { PageSelector } from "./PageSelector.js";

export function BuilderPage() {
  const params = new URLSearchParams(window.location.search);
  const initialPageId = params.get("pageId");
  const initialCollection = params.get("collection");

  const needsResolve = !!(initialPageId && initialCollection);
  const [selected, setSelected] = useState<{ id: string; title: string; collection: string } | null>(null);
  const [resolving, setResolving] = useState(needsResolve);

  useEffect(() => {
    if (!initialPageId || !initialCollection) return;
    apiFetch(`/_emdash/api/plugins/empixel-builder/entries?collection=${initialCollection}`)
      .then(res => parseApiResponse<{ data: { id: string; title: string }[] }>(res, "Failed to load entries"))
      .then(({ data }) => {
        const entry = data?.find(e => e.id === initialPageId);
        setSelected(entry
          ? { id: entry.id, title: entry.title, collection: initialCollection }
          : { id: initialPageId, title: initialPageId, collection: initialCollection }
        );
      })
      .catch(() => {
        setSelected({ id: initialPageId, title: initialPageId, collection: initialCollection });
      })
      .finally(() => setResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) {
      url.searchParams.set("pageId", selected.id);
      url.searchParams.set("collection", selected.collection);
    } else {
      url.searchParams.delete("pageId");
      url.searchParams.delete("collection");
    }
    history.replaceState(null, "", url.toString());
  }, [selected]);

  if (resolving) return <BuilderStyles />;

  return (
    <>
      {selected ? (
        <Builder
          pageId={selected.id}
          pageTitle={selected.title}
          collection={selected.collection}
          onBack={() => setSelected(null)}
        />
      ) : (
        <PageSelector onSelect={(id, title, collection) => setSelected({ id, title, collection })} />
      )}
      <BuilderStyles />
    </>
  );
}
