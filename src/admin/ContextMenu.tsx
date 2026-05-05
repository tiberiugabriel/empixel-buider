import { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  canPaste: boolean;
  canPasteSettings: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onCopySettings: () => void;
  onPaste: () => void;
  onPasteSettings: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  canPaste,
  canPasteSettings,
  onEdit,
  onDuplicate,
  onCopy,
  onCopySettings,
  onPaste,
  onPasteSettings,
  onDelete,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const menuWidth = 180;
  const menuHeight = 250;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <div
      ref={ref}
      className="epx-context-menu"
      style={{ left: adjustedX, top: adjustedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button className="epx-context-menu__item" onClick={onEdit} type="button">
        Edit
      </button>
      <button className="epx-context-menu__item" onClick={onDuplicate} type="button">
        Duplicate
      </button>
      <hr className="epx-context-menu__separator" />
      <button className="epx-context-menu__item" onClick={onCopy} type="button">
        Copy
      </button>
      <button className="epx-context-menu__item" onClick={onCopySettings} type="button">
        Copy Settings
      </button>
      <hr className="epx-context-menu__separator" />
      <button
        className="epx-context-menu__item"
        onClick={onPaste}
        disabled={!canPaste}
        type="button"
      >
        Paste
      </button>
      <button
        className="epx-context-menu__item"
        onClick={onPasteSettings}
        disabled={!canPasteSettings}
        type="button"
      >
        Paste Settings
      </button>
      <hr className="epx-context-menu__separator" />
      <button className="epx-context-menu__item epx-context-menu__item--danger" onClick={onDelete} type="button">
        Delete
      </button>
    </div>
  );
}
