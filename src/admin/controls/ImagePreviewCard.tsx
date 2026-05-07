import React from "react";
import type { MediaRef } from "./MediaPicker.js";

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="28" height="28" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4.5" cy="4.5" r="1.2" fill="currentColor" />
      <path d="M1.5 9.5l3-3 2 2 2.5-3 3 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  image: MediaRef | undefined;
  onSelect: () => void;
  onRemove: () => void;
  emptyLabel?: string;
  boxed?: boolean;
}

export function ImagePreviewCard({ image, onSelect, onRemove, emptyLabel = "Select Image", boxed = false }: Props) {
  const cardClass = `epx-media-card${boxed ? " epx-media-card--boxed" : ""}`;

  if (!image) {
    return (
      <div className={cardClass}>
        <button
          type="button"
          className="epx-media-card__preview epx-media-card__preview--empty"
          onClick={onSelect}
        >
          <div className="epx-media-card__empty-inner">
            <IconImage />
            <span className="epx-media-card__empty-label">{emptyLabel}</span>
          </div>
        </button>
      </div>
    );
  }

  const filename = image.filename ?? "Image selected";
  const src = image.storageKey ? `/_emdash/api/media/file/${image.storageKey}` : undefined;

  return (
    <div className={cardClass}>
      <div className="epx-media-card__preview">
        {src ? (
          <img src={src} alt={image.alt ?? filename} />
        ) : (
          <IconImage />
        )}
      </div>
      <div className="epx-media-card__name" title={filename}>{filename}</div>
      <div className="epx-media-card__actions">
        <button type="button" className="epx-media-card__btn" onClick={onSelect}>Change</button>
        <button
          type="button"
          className="epx-media-card__remove"
          onClick={onRemove}
          title="Remove"
          aria-label="Remove image"
        >
          <IconClose />
        </button>
      </div>
    </div>
  );
}
