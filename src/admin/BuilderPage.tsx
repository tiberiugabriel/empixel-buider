import React, { useCallback, useEffect, useReducer, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { SectionBlock, PageLayout, BlockType } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { LeftPanel } from "./LeftPanel.js";
import { Canvas } from "./Canvas.js";
import { RightPanel } from "./RightPanel.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = { id: string; title: string };

// ─── Builder State ────────────────────────────────────────────────────────────

type State = {
  sections: SectionBlock[];
  selectedId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  saveError: string | null;
};

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; sections: SectionBlock[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "ADD_BLOCK"; block: SectionBlock }
  | { type: "UPDATE_BLOCK"; id: string; config: Record<string, unknown> }
  | { type: "REMOVE_BLOCK"; id: string }
  | { type: "REORDER"; sections: SectionBlock[] }
  | { type: "SELECT"; id: string | null }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR"; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, sections: action.sections, isDirty: false };
    case "LOAD_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "ADD_BLOCK":
      return { ...state, sections: [...state.sections, action.block], selectedId: action.block.id, isDirty: true };
    case "UPDATE_BLOCK":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, config: { ...s.config, ...action.config } } : s
        ),
        isDirty: true,
      };
    case "REMOVE_BLOCK": {
      const next = state.sections.filter((s) => s.id !== action.id);
      return { ...state, sections: next, selectedId: state.selectedId === action.id ? null : state.selectedId, isDirty: true };
    }
    case "REORDER":
      return { ...state, sections: action.sections, isDirty: true };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "SAVE_START":
      return { ...state, isSaving: true, saveError: null };
    case "SAVE_SUCCESS":
      return { ...state, isSaving: false, isDirty: false };
    case "SAVE_ERROR":
      return { ...state, isSaving: false, saveError: action.error };
    default:
      return state;
  }
}

const initialState: State = {
  sections: [],
  selectedId: null,
  isDirty: false,
  isSaving: false,
  isLoading: true,
  error: null,
  saveError: null,
};

// ─── Page Selector ────────────────────────────────────────────────────────────

const COLLECTIONS = [
  { slug: "pages", label: "Pages" },
  { slug: "posts", label: "Posts" },
];

function PageSelector({ onSelect }: { onSelect: (id: string, title: string) => void }) {
  const [collection, setCollection] = useState("pages");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/_emdash/api/plugins/empixel-builder/entries?collection=${collection}`)
      .then((res) => parseApiResponse<{ data: Entry[] }>(res, "Failed to load entries"))
      .then(({ data }) => setEntries(data ?? []))
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [collection]);

  return (
    <div className="epx-selector">
      <div className="epx-selector__header">
        <span className="epx-topbar__logo">⚡ EmPixel Builder</span>
        <p className="epx-selector__subtitle">Select a page or post to edit its layout</p>
        <div className="epx-selector__tabs">
          {COLLECTIONS.map((c) => (
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
      </div>

      <div className="epx-selector__body">
        {loading && <div className="epx-selector__loading"><div className="epx-spinner" />Loading…</div>}
        {error && <p className="epx-error">Error: {error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="epx-selector__empty">No entries found in "{collection}".</p>
        )}
        {!loading && !error && entries.map((entry) => (
          <button
            key={entry.id}
            className="epx-selector__entry"
            onClick={() => onSelect(entry.id, entry.title)}
            type="button"
          >
            <span className="epx-selector__entry-title">{entry.title}</span>
            <span className="epx-selector__entry-id">{entry.id}</span>
            <span className="epx-selector__entry-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Builder ──────────────────────────────────────────────────────────────────

function Builder({ pageId, pageTitle, onBack }: { pageId: string; pageTitle: string; onBack: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const backUrl = new URLSearchParams(window.location.search).get("back") ?? null;

  useEffect(() => {
    dispatch({ type: "LOAD_START" });
    apiFetch(`/_emdash/api/plugins/empixel-builder/layout?pageId=${encodeURIComponent(pageId)}`)
      .then((res) => parseApiResponse<{ data: PageLayout | null }>(res, "Failed to load layout"))
      .then(({ data }) => dispatch({ type: "LOAD_SUCCESS", sections: data?.sections ?? [] }))
      .catch((err: unknown) => dispatch({ type: "LOAD_ERROR", error: String(err) }));
  }, [pageId]);

  const addBlock = useCallback((type: BlockType) => {
    const def = getBlockDef(type);
    if (!def) return;
    dispatch({ type: "ADD_BLOCK", block: { id: crypto.randomUUID(), type, config: { ...def.defaultConfig } } });
  }, []);

  const updateBlock = useCallback((id: string, config: Record<string, unknown>) => {
    dispatch({ type: "UPDATE_BLOCK", id, config });
  }, []);

  const removeBlock = useCallback((id: string) => {
    dispatch({ type: "REMOVE_BLOCK", id });
  }, []);

  const reorder = useCallback((sections: SectionBlock[]) => {
    dispatch({ type: "REORDER", sections });
  }, []);

  const selectBlock = useCallback((id: string) => {
    dispatch({ type: "SELECT", id });
  }, []);

  const save = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    try {
      const res = await apiFetch("/_emdash/api/plugins/empixel-builder/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, sections: state.sections }),
      });
      if (!res.ok) {
        dispatch({ type: "SAVE_ERROR", error: await res.text() || "Save failed" });
      } else {
        dispatch({ type: "SAVE_SUCCESS" });
      }
    } catch (err) {
      dispatch({ type: "SAVE_ERROR", error: String(err) });
    }
  }, [pageId, state.sections]);

  const selectedBlock = state.sections.find((s) => s.id === state.selectedId) ?? null;

  if (state.isLoading) {
    return (
      <div className="epx-builder epx-builder--loading">
        <div className="epx-spinner" />
        <p>Loading layout…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="epx-builder epx-builder--error">
        <p className="epx-error">Failed to load layout: {state.error}</p>
        <button className="epx-btn epx-btn--ghost" onClick={onBack} type="button">← Back</button>
      </div>
    );
  }

  return (
    <div className="epx-builder">
      <header className="epx-topbar">
        <div className="epx-topbar__left">
          <button className="epx-btn epx-btn--ghost" onClick={backUrl ? () => { window.location.href = backUrl; } : onBack} type="button">
            ← Back
          </button>
          <span className="epx-topbar__logo">⚡ EmPixel Builder</span>
          <span className="epx-topbar__page-id">{pageTitle}</span>
        </div>
        <div className="epx-topbar__center">
          {state.isDirty && <span className="epx-topbar__unsaved">Unsaved changes</span>}
          {state.saveError && <span className="epx-topbar__error">Error: {state.saveError}</span>}
        </div>
        <div className="epx-topbar__right">
          <button
            className="epx-btn epx-btn--primary"
            onClick={save}
            disabled={state.isSaving || !state.isDirty}
          >
            {state.isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="epx-builder__panels">
        <LeftPanel onAddBlock={addBlock} />
        <Canvas
          sections={state.sections}
          selectedId={state.selectedId}
          onSelect={selectBlock}
          onRemove={removeBlock}
          onReorder={reorder}
        />
        <RightPanel
          block={selectedBlock}
          onChange={(config) => selectedBlock && updateBlock(selectedBlock.id, config)}
        />
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function BuilderPage() {
  const params = new URLSearchParams(window.location.search);
  const initialPageId = params.get("pageId");

  const [selected, setSelected] = useState<{ id: string; title: string } | null>(
    initialPageId ? { id: initialPageId, title: initialPageId } : null
  );

  return (
    <>
      {selected ? (
        <Builder
          pageId={selected.id}
          pageTitle={selected.title}
          onBack={() => setSelected(null)}
        />
      ) : (
        <PageSelector onSelect={(id, title) => setSelected({ id, title })} />
      )}
      <BuilderStyles />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function BuilderStyles() {
  return (
    <style>{`
      /* ── Selector ── */
      .epx-selector {
        min-height: 100vh;
        background: #f5f5f5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .epx-selector__header {
        background: #fff;
        border-bottom: 1px solid #e0e0e0;
        padding: 32px 40px 0;
      }
      .epx-selector__subtitle {
        color: #888;
        font-size: 14px;
        margin: 6px 0 20px;
      }
      .epx-selector__tabs {
        display: flex;
        gap: 0;
      }
      .epx-selector__tab {
        padding: 10px 20px;
        border: none;
        background: none;
        font-size: 14px;
        font-weight: 500;
        color: #888;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
      }
      .epx-selector__tab.is-active { color: #2563eb; border-bottom-color: #2563eb; }
      .epx-selector__tab:hover:not(.is-active) { color: #444; }

      .epx-selector__body {
        padding: 24px 40px;
        max-width: 720px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .epx-selector__loading {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #888;
        font-size: 14px;
      }
      .epx-selector__empty { color: #aaa; font-size: 14px; }

      .epx-selector__entry {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .epx-selector__entry:hover { border-color: #93c5fd; box-shadow: 0 0 0 3px #dbeafe; }
      .epx-selector__entry-title { font-size: 14px; font-weight: 600; color: #111; flex: 1; }
      .epx-selector__entry-id { font-size: 12px; color: #aaa; font-family: monospace; }
      .epx-selector__entry-arrow { color: #93c5fd; font-size: 16px; }

      /* ── Builder ── */
      .epx-builder {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f5f5;
        color: #111;
      }

      .epx-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 52px;
        padding: 0 16px;
        background: #fff;
        border-bottom: 1px solid #e0e0e0;
        flex-shrink: 0;
        gap: 16px;
      }
      .epx-topbar__left { display: flex; align-items: center; gap: 12px; }
      .epx-topbar__logo { font-weight: 700; font-size: 15px; }
      .epx-topbar__page-id { color: #888; font-size: 13px; }
      .epx-topbar__center { flex: 1; text-align: center; }
      .epx-topbar__unsaved { font-size: 13px; color: #f59e0b; }
      .epx-topbar__error { font-size: 13px; color: #ef4444; }
      .epx-topbar__right { display: flex; gap: 8px; }

      .epx-builder__panels {
        display: grid;
        grid-template-columns: 220px 1fr 280px;
        flex: 1;
        overflow: hidden;
      }

      .epx-btn {
        padding: 7px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 14px;
        cursor: pointer;
        font-weight: 500;
        transition: opacity 0.15s;
      }
      .epx-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .epx-btn--primary { background: #2563eb; color: #fff; }
      .epx-btn--primary:not(:disabled):hover { background: #1d4ed8; }
      .epx-btn--ghost { background: transparent; color: #555; border-color: #d0d0d0; }
      .epx-btn--ghost:hover { background: #f0f0f0; }

      .epx-icon-btn {
        width: 24px; height: 24px; border: none; background: none; cursor: pointer;
        border-radius: 4px; display: flex; align-items: center; justify-content: center;
        font-size: 14px; padding: 0; color: #555;
      }
      .epx-icon-btn:hover:not(:disabled) { background: #e0e0e0; }
      .epx-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .epx-icon-btn--danger:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }

      .epx-left-panel {
        background: #fff; border-right: 1px solid #e0e0e0;
        overflow-y: auto; display: flex; flex-direction: column;
      }
      .epx-left-panel__header { padding: 14px 12px 8px; border-bottom: 1px solid #f0f0f0; }
      .epx-left-panel__title { font-size: 13px; font-weight: 700; margin: 0; }
      .epx-left-panel__hint { font-size: 11px; color: #999; margin: 2px 0 0; }
      .epx-left-panel__list { padding: 8px; display: flex; flex-direction: column; gap: 2px; }

      .epx-block-card {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border: 1px solid transparent; border-radius: 6px; background: none;
        cursor: pointer; text-align: left; width: 100%; font-size: 13px;
        transition: background 0.1s, border-color 0.1s;
      }
      .epx-block-card:hover { background: #f0f4ff; border-color: #c7d2fe; }
      .epx-block-card__icon { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
      .epx-block-card__label { font-weight: 500; color: #222; }

      .epx-canvas { overflow-y: auto; padding: 20px; background: #f5f5f5; }
      .epx-canvas--empty { display: flex; align-items: center; justify-content: center; }
      .epx-canvas__empty-state { text-align: center; color: #999; }
      .epx-canvas__empty-icon { font-size: 48px; margin-bottom: 12px; }
      .epx-canvas__empty-state h3 { margin: 0 0 6px; font-size: 16px; color: #555; }
      .epx-canvas__empty-state p { margin: 0; font-size: 13px; }
      .epx-canvas__list { display: flex; flex-direction: column; gap: 6px; }

      .epx-section-row {
        display: flex; align-items: center; gap: 8px; padding: 10px 12px;
        background: #fff; border: 2px solid transparent; border-radius: 8px;
        cursor: pointer; transition: border-color 0.1s, box-shadow 0.1s;
      }
      .epx-section-row:hover { border-color: #93c5fd; }
      .epx-section-row.is-selected { border-color: #2563eb; box-shadow: 0 0 0 3px #dbeafe; }
      .epx-section-row__drag-handle { cursor: grab; color: #bbb; font-size: 16px; padding: 2px 4px; user-select: none; flex-shrink: 0; }
      .epx-section-row__drag-handle:hover { color: #666; }
      .epx-section-row__info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
      .epx-section-row__icon { font-size: 18px; flex-shrink: 0; }
      .epx-section-row__text { display: flex; flex-direction: column; min-width: 0; }
      .epx-section-row__label { font-weight: 600; font-size: 13px; }
      .epx-section-row__preview { font-size: 11px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .epx-section-row__remove { margin-left: auto; flex-shrink: 0; }

      .epx-right-panel {
        background: #fff; border-left: 1px solid #e0e0e0;
        overflow-y: auto; display: flex; flex-direction: column;
      }
      .epx-right-panel--empty { align-items: center; justify-content: center; }
      .epx-right-panel__placeholder { text-align: center; color: #bbb; padding: 32px 16px; }
      .epx-right-panel__placeholder-icon { font-size: 32px; margin-bottom: 8px; }
      .epx-right-panel__placeholder p { font-size: 13px; margin: 0; }
      .epx-right-panel__header { display: flex; align-items: center; gap: 8px; padding: 14px 14px 6px; border-bottom: 1px solid #f0f0f0; }
      .epx-right-panel__icon { font-size: 20px; }
      .epx-right-panel__title { font-size: 14px; font-weight: 700; margin: 0; }
      .epx-right-panel__description { font-size: 12px; color: #888; padding: 6px 14px 10px; margin: 0; border-bottom: 1px solid #f0f0f0; }
      .epx-right-panel__fields { padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; }

      .epx-field { display: flex; flex-direction: column; gap: 4px; }
      .epx-field__label { font-size: 12px; font-weight: 600; color: #444; }
      .epx-field__required { color: #ef4444; margin-left: 3px; }
      .epx-field__input, .epx-field__select, .epx-field__textarea {
        width: 100%; padding: 6px 8px; border: 1px solid #d0d0d0; border-radius: 5px;
        font-size: 13px; background: #fafafa; box-sizing: border-box; transition: border-color 0.15s;
      }
      .epx-field__input:focus, .epx-field__select:focus, .epx-field__textarea:focus {
        outline: none; border-color: #2563eb; background: #fff;
      }
      .epx-field__textarea { resize: vertical; min-height: 72px; }
      .epx-field--toggle .epx-field__toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .epx-field__toggle-input { width: 16px; height: 16px; cursor: pointer; }

      .epx-json-array { display: flex; flex-direction: column; gap: 6px; }
      .epx-json-array__header { display: flex; align-items: center; justify-content: space-between; }
      .epx-json-array__count { font-size: 11px; color: #999; }
      .epx-json-array__list { display: flex; flex-direction: column; gap: 4px; }
      .epx-json-array__item { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
      .epx-json-array__item.is-expanded { border-color: #93c5fd; }
      .epx-json-array__item-header { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: #f8f8f8; cursor: pointer; user-select: none; }
      .epx-json-array__item-header:hover { background: #f0f0f0; }
      .epx-json-array__item-label { font-size: 12px; font-weight: 600; color: #444; }
      .epx-json-array__item-actions { display: flex; gap: 2px; }
      .epx-json-array__item-body { padding: 10px; display: flex; flex-direction: column; gap: 10px; background: #fff; }

      .epx-btn-add {
        padding: 6px 12px; border: 1px dashed #93c5fd; border-radius: 6px;
        background: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 600;
        cursor: pointer; text-align: center; transition: background 0.1s;
      }
      .epx-btn-add:hover { background: #dbeafe; }

      .epx-builder--loading, .epx-builder--error {
        position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; color: #888; background: #f5f5f5;
      }
      .epx-spinner {
        width: 32px; height: 32px; border: 3px solid #e0e0e0;
        border-top-color: #2563eb; border-radius: 50%;
        animation: epx-spin 0.8s linear infinite;
      }
      @keyframes epx-spin { to { transform: rotate(360deg); } }
      .epx-error { color: #ef4444; }
    `}</style>
  );
}
