import React, { useCallback, useEffect, useReducer, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { SectionBlock, PageLayout, BlockType } from "../types.js";
import { isContainerType } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { LeftPanel } from "./LeftPanel.js";
import { Canvas } from "./Canvas.js";
import { RightPanel } from "./RightPanel.js";
import {
  findBlockById,
  removeFromTree,
  updateBlockInTree,
  addToContainer,
  reorderInContainer,
  findPath,
  insertAtPath,
} from "./treeUtils.js";

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
  | { type: "SAVE_ERROR"; error: string }
  | { type: "ADD_TO_CONTAINER"; containerId: string; slotIndex?: number; block: SectionBlock }
  | { type: "MOVE_BLOCK"; sourceId: string; targetContainerId: string | null; targetSlotIndex: number | null; targetIndex: number }
  | { type: "REORDER_IN_CONTAINER"; containerId: string; slotIndex: number | null; newOrder: SectionBlock[] };

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
      return { ...state, sections: updateBlockInTree(action.id, action.config, state.sections), isDirty: true };
    case "REMOVE_BLOCK":
      return {
        ...state,
        sections: removeFromTree(action.id, state.sections),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        isDirty: true,
      };
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
    case "ADD_TO_CONTAINER": {
      const next = addToContainer(action.containerId, action.slotIndex ?? null, action.block, state.sections);
      return { ...state, sections: next, selectedId: action.block.id, isDirty: true };
    }
    case "MOVE_BLOCK": {
      const block = findBlockById(action.sourceId, state.sections);
      if (!block) return state;
      let next = removeFromTree(action.sourceId, state.sections);
      next = insertAtPath(block, action.targetContainerId === null
        ? { level: "top", index: action.targetIndex }
        : { level: "container", containerId: action.targetContainerId, slotIndex: action.targetSlotIndex, index: action.targetIndex },
        next
      );
      return { ...state, sections: next, isDirty: true };
    }
    case "REORDER_IN_CONTAINER":
      return { ...state, sections: reorderInContainer(action.containerId, action.slotIndex, action.newOrder, state.sections), isDirty: true };
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
    const block: SectionBlock = { id: crypto.randomUUID(), type, config: { ...def.defaultConfig } };
    if (state.selectedId && !isContainerType(type)) {
      const path = findPath(state.selectedId, state.sections);
      if (path?.level === "container") {
        dispatch({ type: "ADD_TO_CONTAINER", containerId: path.containerId, slotIndex: path.slotIndex ?? undefined, block });
        return;
      }
      const selected = findBlockById(state.selectedId, state.sections);
      if (selected && isContainerType(selected.type)) {
        dispatch({ type: "ADD_TO_CONTAINER", containerId: selected.id, slotIndex: selected.type === "columns" ? 0 : undefined, block });
        return;
      }
    }
    dispatch({ type: "ADD_BLOCK", block });
  }, [state.selectedId, state.sections]);

  const addToContainerByType = useCallback((containerId: string, slotIndex: number | null, type: BlockType) => {
    const def = getBlockDef(type);
    if (!def) return;
    const block: SectionBlock = { id: crypto.randomUUID(), type, config: { ...def.defaultConfig } };
    dispatch({ type: "ADD_TO_CONTAINER", containerId, slotIndex: slotIndex ?? undefined, block });
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

  const moveBlock = useCallback((sourceId: string, targetContainerId: string | null, targetSlotIndex: number | null, targetIndex: number) => {
    dispatch({ type: "MOVE_BLOCK", sourceId, targetContainerId, targetSlotIndex, targetIndex });
  }, []);

  const reorderInContainerBlocks = useCallback((containerId: string, slotIndex: number | null, newOrder: SectionBlock[]) => {
    dispatch({ type: "REORDER_IN_CONTAINER", containerId, slotIndex, newOrder });
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

  const selectedBlock = state.selectedId ? findBlockById(state.selectedId, state.sections) : null;

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
          onMoveBlock={moveBlock}
          onReorderInContainer={reorderInContainerBlocks}
          onAddToContainer={addToContainerByType}
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

      .epx-block-preview {
        position: relative; border-radius: 8px; overflow: hidden;
        border: 2px solid transparent; cursor: pointer;
        transition: border-color 0.15s, box-shadow 0.15s;
        background: #fff;
      }
      .epx-block-preview:hover { border-color: #93c5fd; }
      .epx-block-preview.is-selected { border-color: #2563eb; box-shadow: 0 0 0 3px #dbeafe; }
      .epx-block-preview__handle {
        position: absolute; top: 6px; left: 6px; z-index: 10;
        background: rgba(255,255,255,0.9); border: 1px solid #e0e0e0;
        border-radius: 4px; padding: 2px 5px; font-size: 13px; color: #888;
        cursor: grab; user-select: none; line-height: 1;
        transition: opacity 0.15s;
      }
      .epx-block-preview__handle:hover { color: #444; }
      .epx-block-preview__delete {
        position: absolute; top: 6px; right: 6px; z-index: 10;
        background: rgba(255,255,255,0.9); border: 1px solid #e0e0e0;
        border-radius: 4px; width: 22px; height: 22px; display: flex;
        align-items: center; justify-content: center; font-size: 14px;
        color: #888; cursor: pointer; line-height: 1; padding: 0;
        transition: opacity 0.15s, background 0.15s, color 0.15s;
      }
      .epx-block-preview__delete:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

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
      .epx-right-panel__tabs { display: flex; border-bottom: 1px solid #e0e0e0; }
      .epx-right-panel__tab { flex: 1; padding: 8px 0; border: none; background: none; font-size: 13px; font-weight: 500; color: #888; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; }
      .epx-right-panel__tab:hover { color: #444; }
      .epx-right-panel__tab.is-active { color: #2563eb; border-bottom-color: #2563eb; }
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

      /* ── Spacing controls ── */
      .epx-spacing-group { margin-bottom: 16px; }
      .epx-spacing-group__header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 8px;
      }
      .epx-spacing-group__label {
        font-size: 10px; font-weight: 700; color: #666;
        text-transform: uppercase; letter-spacing: 0.06em;
      }
      .epx-spacing-group__link {
        background: none; border: none; cursor: pointer; color: #bbb;
        font-size: 14px; padding: 2px 5px; border-radius: 4px; line-height: 1;
        transition: color 0.15s;
      }
      .epx-spacing-group__link:hover { color: #555; }
      .epx-spacing-group__link.is-linked { color: #2563eb; }

      .epx-spacing-row {
        display: flex; align-items: center; gap: 7px; margin-bottom: 5px;
      }
      .epx-spacing-row__side {
        width: 18px; height: 18px; border: 1.5px solid #d0d0d0; border-radius: 3px;
        flex-shrink: 0; background: #f5f5f5; display: flex; align-items: center;
        justify-content: center; font-size: 8px; font-weight: 700; color: #888;
        letter-spacing: 0;
      }
      .epx-spacing-row__slider {
        flex: 1; height: 4px; cursor: pointer; accent-color: #2563eb;
        -webkit-appearance: none; appearance: none;
        background: linear-gradient(to right, #2563eb var(--pct,0%), #e0e0e0 var(--pct,0%));
        border-radius: 2px; outline: none;
      }
      .epx-spacing-row__slider::-webkit-slider-thumb {
        -webkit-appearance: none; width: 14px; height: 14px;
        background: #2563eb; border-radius: 50%; cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      .epx-spacing-row__slider::-moz-range-thumb {
        width: 14px; height: 14px; background: #2563eb; border: none;
        border-radius: 50%; cursor: pointer;
      }
      .epx-spacing-row__value {
        font-size: 10px; color: #888; width: 22px; text-align: right;
        font-family: monospace; flex-shrink: 0;
      }

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

      .epx-container-block {
        border: 2px dashed #93c5fd; border-radius: 8px; background: #f0f7ff;
        position: relative; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      }
      .epx-container-block:hover { border-color: #60a5fa; }
      .epx-container-block.is-selected { border-color: #2563eb; box-shadow: 0 0 0 3px #dbeafe; }
      .epx-container-block.is-dragging { opacity: 0.4; }
      .epx-container-block__header {
        display: flex; align-items: center; gap: 6px; padding: 6px 8px;
        font-size: 11px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em;
        border-bottom: 1px dashed #bfdbfe;
      }
      .epx-container-block__handle {
        cursor: grab; user-select: none; padding: 2px 4px; border-radius: 3px; color: #93c5fd;
      }
      .epx-container-block__handle:hover { background: rgba(147,197,253,0.2); }
      .epx-container-block__label { flex: 1; }
      .epx-container-block__delete {
        background: none; border: none; cursor: pointer; color: #93c5fd; font-size: 16px; padding: 0 2px; line-height: 1;
        border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;
      }
      .epx-container-block__delete:hover { background: #fee2e2; color: #dc2626; }
      .epx-container-block__children { padding: 6px; display: flex; flex-direction: column; gap: 4px; min-height: 40px; }
      .epx-container__empty-zone {
        border: 1px dashed #bfdbfe; border-radius: 6px; padding: 16px;
        text-align: center; font-size: 11px; color: #93c5fd; background: rgba(219,234,254,0.3);
        transition: background 0.15s, border-color 0.15s;
      }
      .epx-container__empty-zone.is-over { background: #dbeafe; border-color: #3b82f6; color: #2563eb; }

      .epx-columns-block {
        border: 2px dashed #a78bfa; border-radius: 8px; background: #faf5ff;
        position: relative; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      }
      .epx-columns-block:hover { border-color: #7c3aed; }
      .epx-columns-block.is-selected { border-color: #7c3aed; box-shadow: 0 0 0 3px #ede9fe; }
      .epx-columns-block.is-dragging { opacity: 0.4; }
      .epx-columns-block__header {
        display: flex; align-items: center; gap: 6px; padding: 6px 8px;
        font-size: 11px; font-weight: 700; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.05em;
        border-bottom: 1px dashed #ddd6fe;
      }
      .epx-columns-block__handle { cursor: grab; user-select: none; padding: 2px 4px; border-radius: 3px; color: #a78bfa; }
      .epx-columns-block__handle:hover { background: rgba(167,139,250,0.2); }
      .epx-columns-block__label { flex: 1; }
      .epx-columns-block__delete {
        background: none; border: none; cursor: pointer; color: #a78bfa; font-size: 16px; padding: 0 2px; line-height: 1;
        border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;
      }
      .epx-columns-block__delete:hover { background: #fee2e2; color: #dc2626; }
      .epx-columns-block__grid { padding: 6px; display: grid; gap: 6px; }
      .epx-columns__slot {
        border: 1px dashed #ddd6fe; border-radius: 6px; padding: 6px;
        display: flex; flex-direction: column; gap: 4px; min-height: 40px; background: rgba(237,233,254,0.3);
      }
      .epx-columns__slot-label {
        font-size: 10px; font-weight: 600; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.05em; padding: 0 0 4px;
      }

      .epx-add-block-btn {
        margin-top: 4px; padding: 5px 10px; border: 1px dashed #93c5fd; border-radius: 5px;
        background: transparent; color: #60a5fa; font-size: 11px; font-weight: 600;
        cursor: pointer; text-align: center; width: 100%; transition: background 0.1s;
      }
      .epx-add-block-btn:hover { background: #eff6ff; }
      .epx-add-block-picker {
        background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12); margin-top: 4px;
        display: flex; flex-direction: column; gap: 2px;
      }
      .epx-add-block-picker__title { font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase; padding: 0 8px 6px; letter-spacing: 0.05em; }

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
