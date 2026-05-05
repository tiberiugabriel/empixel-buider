import type { SectionBlock } from "../../types.js";
import {
  updateBlockInTree,
  removeFromTree,
  addToContainer,
  insertAtPath,
  findBlockById,
  findPath,
  reorderInContainer,
  deepCloneBlock,
} from "../treeUtils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Entry = {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  builder_enabled: boolean;
};

export type State = {
  sections: SectionBlock[];
  selectedId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  saveError: string | null;
};

export type Action =
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
  | { type: "INSERT_AFTER"; afterId: string; block: SectionBlock }
  | { type: "DUPLICATE_BLOCK"; id: string }
  | { type: "PASTE_SETTINGS"; id: string; config: Record<string, unknown> };

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function reducer(state: State, action: Action): State {
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
    case "DUPLICATE_BLOCK": {
      const orig = findBlockById(action.id, state.sections);
      if (!orig) return state;
      const clone = deepCloneBlock(orig);
      const path = findPath(action.id, state.sections);
      let next: SectionBlock[];
      if (!path) {
        next = [...state.sections, clone];
      } else if (path.level === "top") {
        next = [...state.sections];
        next.splice(path.index + 1, 0, clone);
      } else {
        next = insertAtPath(clone, {
          level: "container",
          containerId: path.containerId,
          slotIndex: path.slotIndex,
          index: path.index + 1,
        }, state.sections);
      }
      return { ...state, sections: next, selectedId: clone.id, isDirty: true };
    }
    case "PASTE_SETTINGS":
      return { ...state, sections: updateBlockInTree(action.id, action.config, state.sections), isDirty: true };
    default:
      return state;
  }
}

export const initialState: State = {
  sections: [],
  selectedId: null,
  isDirty: false,
  isSaving: false,
  isLoading: true,
  error: null,
  saveError: null,
};
