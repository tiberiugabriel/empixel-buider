import { useDndContext } from "@dnd-kit/core";
import type { BlockType, SectionBlock } from "../../types.js";
import { findBlockById } from "../treeUtils.js";
import { getBlockDef } from "../blockDefinitions.js";

export function DragGhost({ sections }: { sections: SectionBlock[] }) {
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
