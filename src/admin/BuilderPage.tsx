import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
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
import { epxVars } from "./epxVars.js";
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

// ─── ThemeToggle ─────────────────────────────────────────────────────────────

const EMDASH_THEME_KEY = "emdash-theme";
type Theme = "light" | "dark" | "system";
const THEME_ORDER: Theme[] = ["system", "light", "dark"];

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" />
  </svg>
);

const MonitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z" />
  </svg>
);

function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() =>
    (localStorage.getItem(EMDASH_THEME_KEY) as Theme | null) ?? "system"
  );

  const apply = (next: Theme) => {
    const resolved = next === "system" ? getSystemTheme() : next;
    localStorage.setItem(EMDASH_THEME_KEY, next);
    document.documentElement.setAttribute("data-mode", resolved);
    setThemeState(next);
  };

  const cycle = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    apply(next);
  };

  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      className="epx-theme-toggle"
      onClick={cycle}
      title={`Theme: ${label}`}
      aria-label={`Toggle theme (current: ${label})`}
      type="button"
    >
      {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <MonitorIcon />}
    </button>
  );
}

// ─── DragGhost ────────────────────────────────────────────────────────────────
// Reads from dnd-kit's own context to avoid React state timing issues

function DragGhost({ sections }: { sections: SectionBlock[] }) {
  const { active } = useDndContext();
  if (!active) return null;

  const data = active.data.current as { kind?: string; blockType?: BlockType } | undefined;
  let def;

  if (data?.kind === "new-block" && data.blockType) {
    def = getBlockDef(data.blockType);
  } else {
    const block = findBlockById(String(active.id), sections);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  useLayoutEffect(() => { sectionsRef.current = state.sections; });

  // Drag state
  const [overBlockId, setOverBlockId] = useState<string | null>(null);

  // Panel resize
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(280);

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => setLeftWidth(Math.max(160, Math.min(420, startWidth + (ev.clientX - startX))));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => setRightWidth(Math.max(200, Math.min(520, startWidth - (ev.clientX - startX))));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [rightWidth]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    dispatch({ type: "LOAD_START" });
    apiFetch(`/_emdash/api/plugins/empixel-builder/layout?pageId=${encodeURIComponent(pageId)}&collection=${encodeURIComponent(collection)}`)
      .then((res) => parseApiResponse<{ data: PageLayout | null }>(res, "Failed to load layout"))
      .then(({ data }) => dispatch({ type: "LOAD_SUCCESS", sections: data?.sections ?? [] }))
      .catch((err: unknown) => dispatch({ type: "LOAD_ERROR", error: String(err) }));
  }, [pageId, collection]);

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
  }, [pageId, collection, state.sections]);

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
            <ThemeToggle />
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

        <div className="epx-builder__panels" style={{ gridTemplateColumns: selectedBlock ? `${leftWidth}px 4px 1fr 4px ${rightWidth}px` : `${leftWidth}px 4px 1fr` }}>
          <LeftPanel onAddBlock={addBlock} />
          <div className="epx-resize-handle" onMouseDown={handleLeftResizeStart} />
          <Canvas
            sections={state.sections}
            selectedId={state.selectedId}
            onSelect={selectBlock}
            onRemove={removeBlock}
            onAddToContainer={addToContainerByType}
            dropIndicatorId={overBlockId}
            onAddAfter={addAfterBlock}
          />
          {selectedBlock && (
            <>
              <div className="epx-resize-handle" onMouseDown={handleRightResizeStart} />
              <RightPanel
                block={selectedBlock}
                onChange={(config) => updateBlock(selectedBlock.id, config)}
              />
            </>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null} zIndex={99999}>
        <DragGhost sections={state.sections} />
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
      /* ── Theme variables ── */
      ${epxVars}

      /* ── Selector ── */
      .epx-selector {
        min-height: 100vh;
        background: var(--epx-bg);
        color: var(--epx-text);
        color-scheme: light dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .epx-selector__header {
        background: var(--epx-surface);
        border-bottom: 1px solid var(--epx-border);
        padding: 32px 40px 0;
      }
      .epx-selector__header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .epx-selector__settings-link {
        font-size: 13px;
        color: var(--epx-text-muted);
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 5px;
        transition: background 0.1s, color 0.1s;
      }
      .epx-selector__settings-link:hover { background: var(--epx-hover-bg); color: var(--epx-text-2); }
      .epx-selector__subtitle {
        color: var(--epx-text-muted);
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
        color: var(--epx-text-muted);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
      }
      .epx-selector__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-selector__tab:hover:not(.is-active) { color: var(--epx-text-2); }

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
        color: var(--epx-text-muted);
        font-size: 14px;
      }
      .epx-selector__empty { color: var(--epx-text-faint); font-size: 14px; }

      .epx-selector__entry {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: var(--epx-surface);
        border: 1px solid var(--epx-border);
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .epx-selector__entry:hover { border-color: var(--epx-accent-light); box-shadow: 0 0 0 3px var(--epx-accent-bg-hover); }
      .epx-selector__entry-title { font-size: 14px; font-weight: 600; color: var(--epx-text); flex: 1; }
      .epx-selector__entry-id { font-size: 12px; color: var(--epx-text-faint); font-family: monospace; }
      .epx-selector__entry-arrow { color: var(--epx-accent-light); font-size: 16px; }

      /* ── Builder ── */
      .epx-builder {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--epx-bg);
        color: var(--epx-text);
        color-scheme: light dark;
      }

      .epx-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 52px;
        padding: 0 16px;
        background: var(--epx-surface);
        border-bottom: 1px solid var(--epx-border);
        flex-shrink: 0;
        gap: 16px;
      }
      .epx-topbar__left { display: flex; align-items: center; gap: 12px; }
      .epx-topbar__logo { font-weight: 700; font-size: 15px; }
      .epx-topbar__page-id { color: var(--epx-text-muted); font-size: 13px; }
      .epx-topbar__center { flex: 1; text-align: center; }
      .epx-topbar__unsaved { font-size: 13px; color: #f59e0b; }
      .epx-topbar__error { font-size: 13px; color: #ef4444; }
      .epx-topbar__right { display: flex; gap: 8px; }

      .epx-theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        background: none;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        color: var(--epx-text-muted);
        transition: background 0.1s, color 0.1s, border-color 0.1s;
        flex-shrink: 0;
      }
      .epx-theme-toggle:hover {
        background: var(--epx-hover-bg);
        border-color: var(--epx-border);
        color: var(--epx-text);
      }

      .epx-builder__panels {
        display: grid;
        flex: 1;
        overflow: hidden;
      }

      .epx-resize-handle {
        background: var(--epx-border);
        cursor: col-resize;
        transition: background 0.15s;
        position: relative;
        z-index: 10;
      }
      .epx-resize-handle::after {
        content: '';
        position: absolute;
        inset: 0 -3px;
      }
      .epx-resize-handle:hover {
        background: var(--epx-accent);
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
      .epx-btn--primary { background: var(--epx-accent); color: #fff; }
      .epx-btn--primary:not(:disabled):hover { background: var(--epx-accent-hover); }
      .epx-btn--ghost { background: transparent; color: var(--epx-text-mid); border-color: var(--epx-input-border); }
      .epx-btn--ghost:hover { background: var(--epx-hover-bg); }

      .epx-left-panel {
        background: var(--epx-surface);
        overflow-y: auto; display: flex; flex-direction: column;
      }
      .epx-left-panel__tabs { display: flex; border-bottom: 1px solid var(--epx-border); }
      .epx-left-panel__tab { flex: 1; padding: 9px 0; border: none; background: none; color: var(--epx-text-faint); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; justify-content: center; }
      .epx-left-panel__tab:hover { color: var(--epx-text-mid); }
      .epx-left-panel__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-left-panel__header { padding: 8px 12px 6px; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-left-panel__hint { font-size: 11px; color: var(--epx-text-faint); margin: 0; }
      .epx-left-panel__list { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
      .epx-left-panel__empty { flex: 1; }

      .epx-block-card {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border: 1px solid transparent; border-radius: 6px; background: none;
        cursor: grab; text-align: left; width: 100%; font-size: 13px;
        transition: background 0.1s, border-color 0.1s;
      }
      .epx-block-card:hover { background: var(--epx-card-hover-bg); border-color: #c7d2fe; }
      .epx-block-card__icon { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
      .epx-block-card__label { font-weight: 500; color: var(--epx-text-strong); }

      /* ── Canvas ── */
      .epx-canvas { overflow-y: auto; padding: 20px; background: var(--epx-bg); }
      .epx-canvas--empty { display: flex; align-items: center; justify-content: center; }
      .epx-canvas__empty-state { text-align: center; color: var(--epx-text-faint); }
      .epx-canvas__empty-icon { font-size: 48px; margin-bottom: 12px; }
      .epx-canvas__empty-state h3 { margin: 0 0 6px; font-size: 16px; color: var(--epx-text-mid); }
      .epx-canvas__empty-state p { margin: 0; font-size: 13px; }
      .epx-canvas__list { display: flex; flex-direction: column; gap: 6px; }

      /* ── Block preview (leaf blocks) ── */
      .epx-block-preview {
        position: relative; border-radius: 8px; overflow: visible;
        border: 1px solid transparent; cursor: pointer;
        transition: border-color 0.15s;
        background: var(--epx-surface);
      }
      .epx-block-preview.is-selected { border-color: var(--epx-selected); }

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
        background: var(--epx-surface); border: 1px solid var(--epx-border); border-radius: 8px; padding: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 30;
        display: flex; flex-direction: column; gap: 2px; min-width: 160px;
      }
      .epx-block-overlay__picker-title {
        font-size: 10px; color: var(--epx-text-muted); font-weight: 700; text-transform: uppercase;
        padding: 0 8px 6px; letter-spacing: 0.05em;
      }

      /* ── Container block (section) ── */
      .epx-container-block {
        border: 1px solid var(--epx-border-card); border-radius: 8px; background: transparent;
        position: relative; cursor: pointer; transition: border-color 0.15s;
        overflow: visible;
      }
      .epx-container-block.is-selected { border-color: var(--epx-selected); }
      .epx-container-block__children {
        padding: 6px; display: flex; flex-direction: column; gap: 4px; min-height: 48px;
      }
      .epx-container-block__add-btn {
        display: flex; align-items: center; justify-content: center;
        padding: 6px 0;
      }
      .epx-container__add-icon {
        width: 26px; height: 26px; border-radius: 50%;
        background: var(--epx-icon-bg); color: var(--epx-text-muted); font-size: 17px; border: none;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.1s, color 0.1s;
      }
      .epx-container__add-icon:hover { background: var(--epx-border-card); color: var(--epx-text-2); }
      .epx-container__empty-zone {
        display: flex; align-items: center; justify-content: center; min-height: 56px;
        border-radius: 6px; transition: background 0.15s;
      }
      .epx-container__empty-zone.is-over { background: rgba(134,239,172,0.12); }

      /* ── Columns block ── */
      .epx-columns-block {
        border: 1px solid var(--epx-border-card); border-radius: 8px; background: transparent;
        position: relative; cursor: pointer; transition: border-color 0.15s;
        overflow: visible;
      }
      .epx-columns-block.is-selected { border-color: var(--epx-selected); }
      .epx-columns-block__grid { padding: 6px; display: grid; gap: 6px; }
      .epx-columns__slot {
        border: 1px dashed var(--epx-border-card); border-radius: 6px; padding: 4px;
        display: flex; flex-direction: column; gap: 4px; min-height: 48px;
      }

      /* ── Drop indicator ── */
      .epx-drop-indicator {
        position: absolute; bottom: -3px; left: 0; right: 0;
        height: 2px; background: var(--epx-selected); border-radius: 1px; z-index: 30;
        pointer-events: none;
      }

      /* ── Drag overlay ghost ── */
      .epx-drag-overlay-ghost {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: var(--epx-surface);
        border: 1px solid #c7d2fe; border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        font-size: 13px; font-weight: 500; color: var(--epx-text-strong);
        pointer-events: none; white-space: nowrap;
        transform: rotate(2deg);
      }
      .epx-drag-overlay-ghost__icon { font-size: 16px; }
      .epx-drag-overlay-ghost__label { color: var(--epx-text-strong); }

      /* ── Right panel ── */
      .epx-right-panel {
        background: var(--epx-surface);
        overflow-y: auto; display: flex; flex-direction: column;
      }
      .epx-right-panel--empty { align-items: center; justify-content: center; }
      .epx-right-panel__placeholder { text-align: center; color: var(--epx-text-faint); padding: 32px 16px; }
      .epx-right-panel__placeholder-icon { font-size: 32px; margin-bottom: 8px; }
      .epx-right-panel__placeholder p { font-size: 13px; margin: 0; }
      .epx-right-panel__header { display: flex; align-items: center; gap: 8px; padding: 14px 14px 6px; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-right-panel__icon { font-size: 20px; }
      .epx-right-panel__title { font-size: 14px; font-weight: 700; margin: 0; }
      .epx-right-panel__description { font-size: 12px; color: var(--epx-text-muted); padding: 6px 14px 10px; margin: 0; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-right-panel__tabs { display: flex; border-bottom: 1px solid var(--epx-border); }
      .epx-right-panel__tab { flex: 1; padding: 9px 0; border: none; background: none; color: var(--epx-text-faint); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; justify-content: center; }
      .epx-right-panel__tab:hover { color: var(--epx-text-mid); }
      .epx-right-panel__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-right-panel__fields { padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; }

      .epx-field { display: flex; flex-direction: column; gap: 4px; }
      .epx-field__label { font-size: 12px; font-weight: 600; color: var(--epx-text-2); }
      .epx-field__required { color: #ef4444; margin-left: 3px; }
      .epx-field__input, .epx-field__select, .epx-field__textarea {
        width: 100%; padding: 6px 8px; border: 1px solid var(--epx-input-border); border-radius: 5px;
        font-size: 13px; background: var(--epx-input-bg); color: var(--epx-text); box-sizing: border-box; transition: border-color 0.15s;
      }
      .epx-field__input:focus, .epx-field__select:focus, .epx-field__textarea:focus {
        outline: none; border-color: var(--epx-accent); background: var(--epx-surface);
      }
      .epx-field__textarea { resize: vertical; min-height: 72px; }
      /* ── Code editor (intentionally always dark — Catppuccin Mocha) ── */
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

      /* ── SpacingControl ── */
      .epx-spacing-ctrl { display: flex; flex-direction: column; container-type: inline-size; }
      .epx-spacing-ctrl__row { display: flex; align-items: center; gap: 2px; }
      .epx-spacing-ctrl__row > .epx-spacing-ctrl__collapsed { flex: 1; min-width: 0; }
      .epx-spacing-ctrl__collapsed {
        display: flex; align-items: center; height: 28px;
        border: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible;
      }
      .epx-spacing-ctrl__collapsed > .epx-side-input {
        flex: 1; min-width: 0; border-top: none; background: transparent;
      }
      .epx-spacing-ctrl__expanded {
        border: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible;
      }
      .epx-spacing-ctrl__exp-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 4px 4px 4px 0; border-bottom: 1px solid var(--epx-border-subtle);
      }
      .epx-spacing-ctrl__label {
        font-size: 10px; font-weight: 700; color: var(--epx-text-mid);
        text-transform: uppercase; letter-spacing: 0.06em; padding: 0 8px;
      }
      .epx-spacing-ctrl__caret {
        background: none; border: none; border-left: 1px solid var(--epx-border-subtle);
        cursor: pointer; color: var(--epx-text-faint);
        font-size: 11px; padding: 0 8px; height: 28px; line-height: 28px;
        flex-shrink: 0; transition: color 0.1s;
      }
      .epx-spacing-ctrl__caret:hover { color: var(--epx-text-mid); }
      .epx-spacing-ctrl__exp-actions { display: flex; align-items: center; }
      .epx-reset-btn {
        background: none; border: none; cursor: pointer; padding: 0 4px; height: 28px;
        display: flex; align-items: center; color: var(--epx-text-faint);
        transition: color 0.1s; flex-shrink: 0;
      }
      .epx-reset-btn:hover { color: var(--epx-accent); }
      .epx-spacing-ctrl__grid { display: grid; }
      .epx-spacing-ctrl__grid--col2 { grid-template-columns: 1fr 1fr; }
      .epx-spacing-ctrl__grid--col1 { grid-template-columns: 1fr; }
      @container (max-width: 220px) {
        .epx-spacing-ctrl__grid--col2 { grid-template-columns: 1fr; }
      }

      /* ── SideInput ── */
      .epx-side-input {
        display: flex; align-items: center; height: 28px;
        background: transparent; position: relative;
        border-top: 1px solid var(--epx-border-subtle);
        min-width: 0;
      }
      .epx-side-input:first-child { border-top: none; }
      .epx-side-input__label {
        flex-shrink: 0; width: 22px; text-align: center;
        font-size: 9px; font-weight: 700; color: var(--epx-text-faint);
        text-transform: uppercase; cursor: ew-resize; user-select: none;
        align-self: stretch; display: flex; align-items: center; justify-content: center;
        transition: color 0.1s, background 0.1s;
        border-right: 1px solid var(--epx-border-subtle);
      }
      .epx-side-input__label:hover { color: var(--epx-accent); background: var(--epx-accent-bg); }
      .epx-side-input__label--full {
        flex: 1; width: auto; justify-content: flex-start; padding: 0 8px;
        font-size: 10px; letter-spacing: 0.06em; border-right: none;
      }
      .epx-side-input__label--icon { color: var(--epx-text-muted); }
      .epx-side-input__num {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 12px; padding: 0 4px;
        text-align: right; outline: none; -moz-appearance: textfield;
      }
      .epx-side-input__num::-webkit-inner-spin-button,
      .epx-side-input__num::-webkit-outer-spin-button { -webkit-appearance: none; }
      .epx-side-input__num:disabled { color: var(--epx-text-faint); }
      .epx-side-input__unit-wrap { position: relative; flex-shrink: 0; }
      .epx-side-input__unit-btn {
        background: none; border: none; border-left: 1px solid var(--epx-border-subtle);
        cursor: pointer; color: var(--epx-text-faint); font-size: 10px; font-weight: 600;
        padding: 0 6px; height: 28px; min-width: 34px; text-align: center;
        transition: color 0.1s, background 0.1s;
      }
      .epx-side-input__unit-btn:hover { color: var(--epx-accent); background: var(--epx-accent-bg); }

      /* ── UnitDropdown ── */
      .epx-unit-dropdown {
        position: absolute; top: calc(100% + 3px); right: 0;
        background: var(--epx-surface); border: 1px solid var(--epx-border);
        border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        z-index: 200; display: flex; flex-direction: column;
        min-width: 60px; padding: 3px;
      }
      .epx-unit-dropdown__item {
        background: none; border: none; cursor: pointer; color: var(--epx-text-mid);
        font-size: 11px; font-weight: 500; padding: 5px 10px;
        text-align: left; border-radius: 4px; transition: background 0.1s, color 0.1s;
      }
      .epx-unit-dropdown__item:hover { background: var(--epx-hover-bg); color: var(--epx-text); }
      .epx-unit-dropdown__item.is-active { color: var(--epx-accent); font-weight: 700; }

      /* ── BorderControl ── */
      .epx-border-style-row {
        display: flex; align-items: center; height: 28px;
        border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-border-style-row > .epx-side-input__label { width: 36px; }
      .epx-border-style-btn { min-width: 56px; font-style: italic; }
      .epx-border-mixed {
        flex: 1; font-size: 11px; color: var(--epx-text-faint);
        font-style: italic; text-align: right; padding: 0 8px;
      }
      .epx-border-color-cell {
        flex: 1; display: flex; align-items: center; gap: 6px;
        padding: 0 8px; border-left: 1px solid var(--epx-border-subtle);
        position: relative; overflow: visible;
      }
      .epx-border-color-swatch {
        width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
        border: 1px solid rgba(128,128,128,0.3); cursor: pointer;
      }
      .epx-border-color-hex {
        font-size: 10px; color: var(--epx-text-muted); font-family: monospace;
      }

      /* ── ColorPicker ── */
      .epx-colorpicker {
        position: fixed; width: 220px;
        background: var(--epx-surface); border: 1px solid var(--epx-border);
        border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,0.22);
        z-index: 9999; overflow: hidden;
      }
      .epx-colorpicker__field {
        position: relative; height: 150px; cursor: crosshair; user-select: none;
      }
      .epx-colorpicker__field-white {
        position: absolute; inset: 0;
        background: linear-gradient(to right, #fff, transparent);
      }
      .epx-colorpicker__field-black {
        position: absolute; inset: 0;
        background: linear-gradient(to bottom, transparent, #000);
      }
      .epx-colorpicker__field-handle {
        position: absolute; width: 12px; height: 12px; border-radius: 50%;
        border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .epx-colorpicker__sliders { padding: 8px 10px 4px; display: flex; flex-direction: column; gap: 6px; }
      .epx-colorpicker__hue {
        position: relative; height: 10px; border-radius: 5px; cursor: pointer; user-select: none;
        background: linear-gradient(to right,
          hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
          hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%));
      }
      .epx-colorpicker__alpha-track {
        position: relative; height: 10px; border-radius: 5px; cursor: pointer; user-select: none;
        background-image: linear-gradient(45deg, #aaa 25%, transparent 25%),
          linear-gradient(-45deg, #aaa 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #aaa 75%),
          linear-gradient(-45deg, transparent 75%, #aaa 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
        overflow: hidden;
      }
      .epx-colorpicker__alpha-fill { position: absolute; inset: 0; }
      .epx-colorpicker__slider-thumb {
        position: absolute; top: 50%; width: 14px; height: 14px;
        background: #fff; border-radius: 50%;
        border: 2px solid rgba(0,0,0,0.25); box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .epx-colorpicker__inputs {
        display: flex; align-items: center; gap: 5px; padding: 6px 10px 10px;
      }
      .epx-colorpicker__eyedrop {
        flex-shrink: 0; width: 26px; height: 26px; border-radius: 4px;
        border: 1px solid var(--epx-border); background: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: var(--epx-text-muted); transition: color 0.1s, border-color 0.1s;
      }
      .epx-colorpicker__eyedrop:hover { color: var(--epx-text); border-color: var(--epx-text-muted); }
      .epx-colorpicker__hex-field {
        flex: 1; display: flex; align-items: center; gap: 2px;
        background: var(--epx-input-bg); border: 1px solid var(--epx-border);
        border-radius: 4px; padding: 0 6px; height: 26px; cursor: text;
      }
      .epx-colorpicker__hex-field span { font-size: 11px; color: var(--epx-text-faint); }
      .epx-colorpicker__hex-input {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 11px; font-family: monospace;
        outline: none; text-transform: uppercase;
      }
      .epx-colorpicker__alpha-field {
        display: flex; align-items: center;
        background: var(--epx-input-bg); border: 1px solid var(--epx-border);
        border-radius: 4px; padding: 0 5px; height: 26px; width: 54px; flex-shrink: 0;
      }
      .epx-colorpicker__alpha-field span { font-size: 11px; color: var(--epx-text-faint); }
      .epx-colorpicker__alpha-input {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 11px; text-align: right; outline: none;
        -moz-appearance: textfield;
      }
      .epx-colorpicker__alpha-input::-webkit-inner-spin-button,
      .epx-colorpicker__alpha-input::-webkit-outer-spin-button { -webkit-appearance: none; }

      .epx-json-array { display: flex; flex-direction: column; gap: 6px; }
      .epx-json-array__header { display: flex; align-items: center; justify-content: space-between; }
      .epx-json-array__count { font-size: 11px; color: var(--epx-text-faint); }
      .epx-json-array__list { display: flex; flex-direction: column; gap: 4px; }
      .epx-json-array__item { border: 1px solid var(--epx-border); border-radius: 6px; overflow: hidden; }
      .epx-json-array__item.is-expanded { border-color: var(--epx-accent-light); }
      .epx-json-array__item-header { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: var(--epx-surface-2); cursor: pointer; user-select: none; }
      .epx-json-array__item-header:hover { background: var(--epx-hover-bg); }
      .epx-json-array__item-label { font-size: 12px; font-weight: 600; color: var(--epx-text-2); }
      .epx-json-array__item-actions { display: flex; gap: 2px; }
      .epx-json-array__item-body { padding: 10px; display: flex; flex-direction: column; gap: 10px; background: var(--epx-surface); }

      .epx-btn-add {
        padding: 6px 12px; border: 1px dashed var(--epx-accent-light); border-radius: 6px;
        background: var(--epx-accent-bg); color: var(--epx-accent); font-size: 12px; font-weight: 600;
        cursor: pointer; text-align: center; transition: background 0.1s;
      }
      .epx-btn-add:hover { background: var(--epx-accent-bg-hover); }

      .epx-icon-btn {
        width: 24px; height: 24px; border: none; background: none; cursor: pointer;
        border-radius: 4px; display: flex; align-items: center; justify-content: center;
        font-size: 14px; padding: 0; color: var(--epx-text-mid);
      }
      .epx-icon-btn:hover:not(:disabled) { background: var(--epx-border); }
      .epx-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .epx-icon-btn--danger:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }
      [data-mode="dark"] .epx-icon-btn--danger:hover:not(:disabled) { background: #3b0f0f; }

      .epx-builder--loading, .epx-builder--error {
        position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; color: var(--epx-text-muted); background: var(--epx-bg);
        color-scheme: light dark;
      }
      .epx-spinner {
        width: 32px; height: 32px; border: 3px solid var(--epx-spinner-track);
        border-top-color: var(--epx-accent); border-radius: 50%;
        animation: epx-spin 0.8s linear infinite;
      }
      @keyframes epx-spin { to { transform: rotate(360deg); } }
      .epx-error { color: #ef4444; }
    `}</style>
  );
}
