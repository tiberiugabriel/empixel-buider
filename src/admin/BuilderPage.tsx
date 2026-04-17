import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDndContext,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { SectionBlock, PageLayout, BlockType } from "../types.js";
import { isContainerType } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { LeftPanel } from "./LeftPanel.js";
import { Canvas, CANVAS_DROP_ID, type BlockDragData, type EmptyZoneData } from "./Canvas.js";
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
  | { type: "REORDER_IN_CONTAINER"; containerId: string; slotIndex: number | null; newOrder: SectionBlock[] }
  | { type: "INSERT_AFTER"; afterId: string; block: SectionBlock };

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
    case "INSERT_AFTER": {
      const path = findPath(action.afterId, state.sections);
      let next: SectionBlock[];
      if (!path) {
        next = [...state.sections, action.block];
      } else if (path.level === "top") {
        next = [...state.sections];
        next.splice(path.index + 1, 0, action.block);
      } else {
        next = insertAtPath(action.block, {
          level: "container",
          containerId: path.containerId,
          slotIndex: path.slotIndex,
          index: path.index + 1,
        }, state.sections);
      }
      return { ...state, sections: next, selectedId: action.block.id, isDirty: true };
    }
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

// ─── DragGhost ────────────────────────────────────────────────────────────────
// Reads from dnd-kit's own context to avoid React state timing issues

function DragGhost({ sectionsRef }: { sectionsRef: React.RefObject<SectionBlock[]> }) {
  const { active } = useDndContext();
  if (!active) return null;

  const data = active.data.current as { kind?: string; blockType?: BlockType } | undefined;
  let def;

  if (data?.kind === "new-block" && data.blockType) {
    def = getBlockDef(data.blockType);
  } else {
    const block = findBlockById(String(active.id), sectionsRef.current ?? []);
    if (block) def = getBlockDef(block.type);
  }

  if (!def) return null;

  return (
    <div className="epx-drag-overlay-ghost">
      <span className="epx-drag-overlay-ghost__icon">{def.icon}</span>
      <span className="epx-drag-overlay-ghost__label">{def.label}</span>
    </div>
  );
}

// ─── Page Selector ────────────────────────────────────────────────────────────

type CollectionTab = { slug: string; label: string };

function PageSelector({ onSelect }: { onSelect: (id: string, title: string, collection: string) => void }) {
  const [collections, setCollections] = useState<CollectionTab[]>([]);
  const [collection, setCollection] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load enabled collections from plugin
  useEffect(() => {
    apiFetch("/_emdash/api/plugins/empixel-builder/collections")
      .then((res) => parseApiResponse<{ data: string[] }>(res, "Failed to load collections"))
      .then(({ data }) => {
        const tabs = (data ?? []).map((slug) => ({ slug, label: slug.charAt(0).toUpperCase() + slug.slice(1) }));
        setCollections(tabs);
        if (tabs.length > 0) setCollection(tabs[0].slug);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!collection) return;
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
        <div className="epx-selector__header-top">
          <span className="epx-topbar__logo">⚡ EmPixel Builder</span>
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
        {collections.length === 0 && (
          <p className="epx-selector__empty">
            No collections enabled. Go to <a href="/_emdash/admin/plugins/empixel-builder/settings">Settings</a> to enable the builder on a collection.
          </p>
        )}
        {collections.length > 0 && loading && <div className="epx-selector__loading"><div className="epx-spinner" />Loading…</div>}
        {collections.length > 0 && error && <p className="epx-error">Error: {error}</p>}
        {collections.length > 0 && !loading && !error && entries.length === 0 && (
          <p className="epx-selector__empty">No entries found in "{collection}".</p>
        )}
        {collections.length > 0 && !loading && !error && entries.map((entry) => (
          <button
            key={entry.id}
            className="epx-selector__entry"
            onClick={() => onSelect(entry.id, entry.title, collection)}
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

function Builder({ pageId, pageTitle, collection, onBack }: { pageId: string; pageTitle: string; collection: string; onBack: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const backUrl = new URLSearchParams(window.location.search).get("back") ?? null;

  // Keep a ref to sections to avoid stale closure in drag handlers
  const sectionsRef = useRef(state.sections);
  sectionsRef.current = state.sections;

  // Drag state
  const [overBlockId, setOverBlockId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    dispatch({ type: "LOAD_START" });
    apiFetch(`/_emdash/api/plugins/empixel-builder/layout?pageId=${encodeURIComponent(pageId)}&collection=${encodeURIComponent(collection)}`)
      .then((res) => parseApiResponse<{ data: PageLayout | null }>(res, "Failed to load layout"))
      .then(({ data }) => dispatch({ type: "LOAD_SUCCESS", sections: data?.sections ?? [] }))
      .catch((err: unknown) => dispatch({ type: "LOAD_ERROR", error: String(err) }));
  }, [pageId]);

  const handleDragStart = useCallback((_: DragStartEvent) => {
    // ghost is rendered via DragGhost which reads from useDndContext directly
  }, []);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    const data = active.data.current as { kind: string } | undefined;
    if (data?.kind === "new-block") {
      const overData = over?.data.current as { kind: string } | undefined;
      setOverBlockId(over && overData?.kind === "block" ? String(over.id) : null);
    }
  }, []);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setOverBlockId(null);

    const sections = sectionsRef.current;
    const activeData = active.data.current as BlockDragData | { kind: "new-block"; blockType: BlockType } | undefined;

    // ── New block dragged from sidebar ──
    if (activeData?.kind === "new-block") {
      const { blockType } = activeData as { kind: "new-block"; blockType: BlockType };
      const def = getBlockDef(blockType);
      if (!def) return;
      const newBlock: SectionBlock = { id: crypto.randomUUID(), type: blockType, config: { ...def.defaultConfig } };

      if (!over) return;
      const overData = over.data.current as EmptyZoneData | BlockDragData | undefined;

      // Dropped on canvas background → append at end
      if (over.id === CANVAS_DROP_ID) {
        dispatch({ type: "ADD_BLOCK", block: newBlock });
        return;
      }
      // Dropped on empty zone inside container
      if (overData?.kind === "empty-zone") {
        const ezd = overData as EmptyZoneData;
        dispatch({ type: "ADD_TO_CONTAINER", containerId: ezd.containerId, slotIndex: ezd.slotIndex ?? undefined, block: newBlock });
        return;
      }
      // Dropped on a container block itself → add inside it
      if ((overData as BlockDragData)?.isContainer) {
        dispatch({ type: "ADD_TO_CONTAINER", containerId: String(over.id), block: newBlock });
        return;
      }
      // Dropped on a specific block → insert after it
      dispatch({ type: "INSERT_AFTER", afterId: String(over.id), block: newBlock });
      return;
    }

    // ── Canvas block reorder / move ──
    if (activeData?.kind !== "block") return;
    if (active.id === over?.id) return;
    if (!over) return;

    const overData = over.data.current as EmptyZoneData | BlockDragData | undefined;

    // Dropped on empty zone → move to container slot
    if (overData?.kind === "empty-zone") {
      const ezd = overData as EmptyZoneData;
      dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: ezd.containerId, targetSlotIndex: ezd.slotIndex, targetIndex: 0 });
      return;
    }

    const activeBlockData = activeData as BlockDragData;
    const overBlockData = overData as BlockDragData | undefined;
    const activeContainerId = activeBlockData.containerId;
    const activeSlotIndex = activeBlockData.slotIndex ?? null;
    const overContainerId = overBlockData?.containerId ?? null;
    const overSlotIndex = overBlockData?.slotIndex ?? null;

    // Dropped directly on a container block → move inside it (append)
    if (overBlockData?.isContainer && !activeBlockData.isContainer) {
      const container = findBlockById(String(over.id), sections);
      const targetIndex = container?.children?.length ?? 0;
      dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: String(over.id), targetSlotIndex: null, targetIndex });
      return;
    }

    // Same container (or both top-level) → reorder
    if (activeContainerId === overContainerId && activeSlotIndex === overSlotIndex) {
      if (activeContainerId === null) {
        // Top-level reorder
        const oldIdx = sections.findIndex((s) => s.id === active.id);
        const newIdx = sections.findIndex((s) => s.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const next = [...sections];
          const [removed] = next.splice(oldIdx, 1);
          next.splice(newIdx, 0, removed);
          dispatch({ type: "REORDER", sections: next });
        }
      } else {
        // Reorder within container/slot
        const container = findBlockById(activeContainerId, sections);
        if (!container) return;
        const items = activeSlotIndex !== null
          ? (container.slots?.[activeSlotIndex] ?? [])
          : (container.children ?? []);
        const oldIdx = items.findIndex((s) => s.id === active.id);
        const newIdx = items.findIndex((s) => s.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const next = [...items];
          const [removed] = next.splice(oldIdx, 1);
          next.splice(newIdx, 0, removed);
          dispatch({ type: "REORDER_IN_CONTAINER", containerId: activeContainerId, slotIndex: activeSlotIndex, newOrder: next });
        }
      }
      return;
    }

    // Different containers → move
    const path = findPath(String(over.id), sections);
    const targetIndex = path ? path.index : 0;
    dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: overContainerId, targetSlotIndex: overSlotIndex, targetIndex });
  }, []);

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

  const addAfterBlock = useCallback((afterId: string, type: BlockType) => {
    const def = getBlockDef(type);
    if (!def) return;
    const block: SectionBlock = { id: crypto.randomUUID(), type, config: { ...def.defaultConfig } };
    dispatch({ type: "INSERT_AFTER", afterId, block });
  }, []);

  const updateBlock = useCallback((id: string, config: Record<string, unknown>) => {
    dispatch({ type: "UPDATE_BLOCK", id, config });
  }, []);

  const removeBlock = useCallback((id: string) => {
    dispatch({ type: "REMOVE_BLOCK", id });
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
        body: JSON.stringify({ pageId, collection, sections: state.sections }),
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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
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
            onAddToContainer={addToContainerByType}
            dropIndicatorId={overBlockId}
            onAddAfter={addAfterBlock}
          />
          <RightPanel
            block={selectedBlock}
            onChange={(config) => selectedBlock && updateBlock(selectedBlock.id, config)}
          />
        </div>
      </div>

      <DragOverlay dropAnimation={null} zIndex={99999}>
        <DragGhost sectionsRef={sectionsRef} />
      </DragOverlay>
    </DndContext>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function BuilderPage() {
  const params = new URLSearchParams(window.location.search);
  const initialPageId = params.get("pageId");
  const initialCollection = params.get("collection");

  const [selected, setSelected] = useState<{ id: string; title: string; collection: string } | null>(
    initialPageId && initialCollection ? { id: initialPageId, title: initialPageId, collection: initialCollection } : null
  );

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
      .epx-selector__header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .epx-selector__settings-link {
        font-size: 13px;
        color: #888;
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 5px;
        transition: background 0.1s, color 0.1s;
      }
      .epx-selector__settings-link:hover { background: #f0f0f0; color: #444; }
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
        cursor: grab; text-align: left; width: 100%; font-size: 13px;
        transition: background 0.1s, border-color 0.1s;
      }
      .epx-block-card:hover { background: #f0f4ff; border-color: #c7d2fe; }
      .epx-block-card__icon { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
      .epx-block-card__label { font-weight: 500; color: #222; }

      /* ── Canvas ── */
      .epx-canvas { overflow-y: auto; padding: 20px; background: #f5f5f5; }
      .epx-canvas--empty { display: flex; align-items: center; justify-content: center; }
      .epx-canvas__empty-state { text-align: center; color: #999; }
      .epx-canvas__empty-icon { font-size: 48px; margin-bottom: 12px; }
      .epx-canvas__empty-state h3 { margin: 0 0 6px; font-size: 16px; color: #555; }
      .epx-canvas__empty-state p { margin: 0; font-size: 13px; }
      .epx-canvas__list { display: flex; flex-direction: column; gap: 6px; }

      /* ── Block preview (leaf blocks) ── */
      .epx-block-preview {
        position: relative; border-radius: 8px; overflow: visible;
        border: 1px solid transparent; cursor: pointer;
        transition: border-color 0.15s;
        background: #fff;
      }
      .epx-block-preview.is-selected { border-color: #86efac; }

      /* ── BlockOverlay ── */
      .epx-block-overlay {
        position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
        z-index: 20; display: flex; align-items: center; gap: 2px;
        background: rgba(20,20,20,0.82); border-radius: 6px; padding: 3px 4px;
        opacity: 0; pointer-events: none; transition: opacity 0.15s;
        white-space: nowrap;
      }
      .epx-block-overlay.is-visible { opacity: 1; pointer-events: auto; }
      .epx-block-overlay__btn {
        background: none; border: none; color: #fff; cursor: pointer;
        width: 26px; height: 26px; border-radius: 4px; font-size: 15px;
        display: flex; align-items: center; justify-content: center; padding: 0;
        transition: background 0.1s;
      }
      .epx-block-overlay__btn:hover { background: rgba(255,255,255,0.15); }
      .epx-block-overlay__btn--delete:hover { background: rgba(220,38,38,0.8); }
      .epx-block-overlay__handle {
        color: #ccc; cursor: grab; user-select: none;
        width: 26px; height: 26px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; transition: background 0.1s, color 0.1s;
      }
      .epx-block-overlay__handle:hover { background: rgba(255,255,255,0.15); color: #fff; }
      .epx-block-overlay__picker {
        position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%);
        background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.14); z-index: 30;
        display: flex; flex-direction: column; gap: 2px; min-width: 160px;
      }
      .epx-block-overlay__picker-title {
        font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase;
        padding: 0 8px 6px; letter-spacing: 0.05em;
      }

      /* ── Container block (section) ── */
      .epx-container-block {
        border: 1px solid #e5e7eb; border-radius: 8px; background: transparent;
        position: relative; cursor: pointer; transition: border-color 0.15s;
        overflow: visible;
      }
      .epx-container-block.is-selected { border-color: #86efac; }
      .epx-container-block__children {
        padding: 6px; display: flex; flex-direction: column; gap: 4px; min-height: 48px;
      }
      .epx-container-block__add-btn {
        display: flex; align-items: center; justify-content: center;
        padding: 6px 0;
      }
      .epx-container__add-icon {
        width: 26px; height: 26px; border-radius: 50%;
        background: #f3f4f6; color: #888; font-size: 17px; border: none;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.1s, color 0.1s;
      }
      .epx-container__add-icon:hover { background: #e5e7eb; color: #444; }
      .epx-container__empty-zone {
        display: flex; align-items: center; justify-content: center; min-height: 56px;
        border-radius: 6px; transition: background 0.15s;
      }
      .epx-container__empty-zone.is-over { background: rgba(134,239,172,0.12); }

      /* ── Columns block ── */
      .epx-columns-block {
        border: 1px solid #e5e7eb; border-radius: 8px; background: transparent;
        position: relative; cursor: pointer; transition: border-color 0.15s;
        overflow: visible;
      }
      .epx-columns-block.is-selected { border-color: #86efac; }
      .epx-columns-block__grid { padding: 6px; display: grid; gap: 6px; }
      .epx-columns__slot {
        border: 1px dashed #e5e7eb; border-radius: 6px; padding: 4px;
        display: flex; flex-direction: column; gap: 4px; min-height: 48px;
      }

      /* ── Drop indicator ── */
      .epx-drop-indicator {
        position: absolute; bottom: -3px; left: 0; right: 0;
        height: 2px; background: #86efac; border-radius: 1px; z-index: 30;
        pointer-events: none;
      }

      /* ── Drag overlay ghost ── */
      .epx-drag-overlay-ghost {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: #fff;
        border: 1px solid #c7d2fe; border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.14);
        font-size: 13px; font-weight: 500; color: #222;
        pointer-events: none; white-space: nowrap;
        transform: rotate(2deg);
      }
      .epx-drag-overlay-ghost__icon { font-size: 16px; }
      .epx-drag-overlay-ghost__label { color: #222; }

      /* ── Right panel ── */
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
      .epx-right-panel__tab { flex: 1; padding: 9px 0; border: none; background: none; color: #aaa; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; justify-content: center; }
      .epx-right-panel__tab:hover { color: #555; }
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
      /* ── Code editor ── */
      .epx-code-editor {
        border: 1px solid #2a2a3d; border-radius: 6px; overflow: hidden;
        font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
        font-size: 12px; line-height: 1.7; background: #1e1e2e;
      }
      .epx-code-editor__header {
        padding: 5px 10px; background: #13131f; border-bottom: 1px solid #2a2a3d;
        display: flex; align-items: center; gap: 4px; font-size: 11px;
      }
      .epx-code-editor__selector-kw { color: #cba6f7; font-style: italic; }
      .epx-code-editor__selector-eq { color: #6c7086; }
      .epx-code-editor__selector-val { color: #89dceb; }
      .epx-code-editor__body {
        display: flex; min-height: 140px; max-height: 280px; overflow: hidden;
      }
      .epx-code-editor__line-nums {
        padding: 8px 0; min-width: 36px; text-align: right;
        background: #181825; color: #45475a; border-right: 1px solid #2a2a3d;
        overflow: hidden; flex-shrink: 0; user-select: none;
      }
      .epx-code-editor__line-num { padding: 0 8px; height: calc(1.7 * 12px); box-sizing: content-box; }
      .epx-code-editor__textarea {
        flex: 1; padding: 8px 10px; border: none; outline: none; resize: none;
        background: #1e1e2e; color: #cdd6f4; font-family: inherit; font-size: inherit;
        line-height: inherit; overflow-y: auto; box-sizing: border-box;
        caret-color: #f5c2e7;
      }
      .epx-code-editor__textarea::placeholder { color: #45475a; }
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

      .epx-icon-btn {
        width: 24px; height: 24px; border: none; background: none; cursor: pointer;
        border-radius: 4px; display: flex; align-items: center; justify-content: center;
        font-size: 14px; padding: 0; color: #555;
      }
      .epx-icon-btn:hover:not(:disabled) { background: #e0e0e0; }
      .epx-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .epx-icon-btn--danger:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }

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
