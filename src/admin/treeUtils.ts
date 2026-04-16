import type { SectionBlock } from "../types.js";

// ─── Path types ───────────────────────────────────────────────────────────────

export type BlockPath =
  | { level: "top"; index: number }
  | { level: "container"; containerId: string; slotIndex: number | null; index: number };

// ─── findPath ─────────────────────────────────────────────────────────────────

export function findPath(id: string, sections: SectionBlock[]): BlockPath | null {
  for (let i = 0; i < sections.length; i++) {
    const block = sections[i];
    if (block.id === id) return { level: "top", index: i };

    // Search in children (section container)
    if (block.children) {
      for (let j = 0; j < block.children.length; j++) {
        if (block.children[j].id === id) {
          return { level: "container", containerId: block.id, slotIndex: null, index: j };
        }
      }
    }

    // Search in slots (columns container)
    if (block.slots) {
      for (let s = 0; s < block.slots.length; s++) {
        for (let j = 0; j < block.slots[s].length; j++) {
          if (block.slots[s][j].id === id) {
            return { level: "container", containerId: block.id, slotIndex: s, index: j };
          }
        }
      }
    }
  }
  return null;
}

// ─── findBlockById ────────────────────────────────────────────────────────────

export function findBlockById(id: string, sections: SectionBlock[]): SectionBlock | null {
  for (const block of sections) {
    if (block.id === id) return block;
    if (block.children) {
      const found = findBlockById(id, block.children);
      if (found) return found;
    }
    if (block.slots) {
      for (const slot of block.slots) {
        const found = findBlockById(id, slot);
        if (found) return found;
      }
    }
  }
  return null;
}

// ─── removeFromTree ───────────────────────────────────────────────────────────

export function removeFromTree(id: string, sections: SectionBlock[]): SectionBlock[] {
  return sections
    .filter((b) => b.id !== id)
    .map((b) => {
      if (b.children) {
        return { ...b, children: removeFromTree(id, b.children) };
      }
      if (b.slots) {
        return { ...b, slots: b.slots.map((slot) => removeFromTree(id, slot)) };
      }
      return b;
    });
}

// ─── updateBlockInTree ────────────────────────────────────────────────────────

export function updateBlockInTree(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>,
  sections: SectionBlock[]
): SectionBlock[] {
  return sections.map((b) => {
    if (b.id === id) return { ...b, config: { ...b.config, ...config } };
    if (b.children) return { ...b, children: updateBlockInTree(id, config, b.children) };
    if (b.slots) return { ...b, slots: b.slots.map((slot) => updateBlockInTree(id, config, slot)) };
    return b;
  });
}

// ─── insertAtPath ─────────────────────────────────────────────────────────────

export function insertAtPath(
  block: SectionBlock,
  path: BlockPath,
  sections: SectionBlock[]
): SectionBlock[] {
  if (path.level === "top") {
    const next = [...sections];
    next.splice(path.index, 0, block);
    return next;
  }

  return sections.map((b) => {
    if (b.id !== path.containerId) return b;

    if (path.slotIndex === null) {
      // Insert into children
      const next = [...(b.children ?? [])];
      next.splice(path.index, 0, block);
      return { ...b, children: next };
    } else {
      // Insert into a specific slot
      const nextSlots = (b.slots ?? []).map((slot, i) => {
        if (i !== path.slotIndex) return slot;
        const next = [...slot];
        next.splice(path.index, 0, block);
        return next;
      });
      return { ...b, slots: nextSlots };
    }
  });
}

// ─── reorderInContainer ───────────────────────────────────────────────────────

export function reorderInContainer(
  containerId: string,
  slotIndex: number | null,
  newOrder: SectionBlock[],
  sections: SectionBlock[]
): SectionBlock[] {
  return sections.map((b) => {
    if (b.id !== containerId) return b;
    if (slotIndex === null) {
      return { ...b, children: newOrder };
    }
    const nextSlots = (b.slots ?? []).map((slot, i) => (i === slotIndex ? newOrder : slot));
    return { ...b, slots: nextSlots };
  });
}

// ─── addToContainer ──────────────────────────────────────────────────────────

export function addToContainer(
  containerId: string,
  slotIndex: number | null,
  block: SectionBlock,
  sections: SectionBlock[]
): SectionBlock[] {
  return sections.map((b) => {
    if (b.id !== containerId) return b;
    if (slotIndex === null) {
      return { ...b, children: [...(b.children ?? []), block] };
    }
    const nextSlots = (b.slots ?? []).map((slot, i) =>
      i === slotIndex ? [...slot, block] : slot
    );
    return { ...b, slots: nextSlots };
  });
}
