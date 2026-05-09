import React from "react";
import { ImagePreviewCard } from "../ImagePreviewCard.js";
import {
  BgOptionRow,
  IMG_ATTACHMENT_OPTIONS,
  IMG_POSITION_OPTIONS,
  IMG_REPEAT_OPTIONS,
  IMG_SIZE_OPTIONS,
} from "./common.js";
import type { BackgroundConfig } from "./serialize.js";

/**
 * Image mode body — Media / URL toggle, ImagePreviewCard or url
 * input, and the four CSS-rule rows (size / position / repeat /
 * attachment).
 *
 * Extracted in F4.7 from `BackgroundControl.tsx`. The media-picker
 * modal lives in the parent — this sub calls `openMediaPicker()` to
 * surface it.
 */
interface Props {
  value: BackgroundConfig;
  onChange: (next: BackgroundConfig) => void;
  openMediaPicker: () => void;
}

export function ImageSub({ value, onChange, openMediaPicker }: Props) {
  return (
    <>
      <div className="epx-bg-ctrl__src-toggle">
        <button
          type="button"
          className={`epx-bg-ctrl__src-btn${(value.imageSrc ?? "media") === "media" ? " is-active" : ""}`}
          onClick={() => onChange({ ...value, imageSrc: "media" })}
        >
          Media
        </button>
        <button
          type="button"
          className={`epx-bg-ctrl__src-btn${value.imageSrc === "url" ? " is-active" : ""}`}
          onClick={() => onChange({ ...value, imageSrc: "url" })}
        >
          URL
        </button>
      </div>

      {(value.imageSrc ?? "media") === "media" && (
        <ImagePreviewCard
          image={value.image}
          onSelect={openMediaPicker}
          onRemove={() => onChange({ ...value, image: undefined })}
        />
      )}

      {value.imageSrc === "url" && (
        <div className="epx-bg-ctrl__url-row">
          <span className="epx-bg-ctrl__stop-label">URL</span>
          <input
            type="url"
            className="epx-bg-ctrl__url-input"
            value={value.imageUrl ?? ""}
            placeholder="https://example.com/image.jpg"
            onChange={e => onChange({ ...value, imageUrl: e.target.value })}
          />
        </div>
      )}

      <BgOptionRow label="Size"       value={value.imageSize       ?? ""} options={IMG_SIZE_OPTIONS}       onChange={v => onChange({ ...value, imageSize: v })} />
      <BgOptionRow label="Position"   value={value.imagePosition   ?? ""} options={IMG_POSITION_OPTIONS}   onChange={v => onChange({ ...value, imagePosition: v })} />
      <BgOptionRow label="Repeat"     value={value.imageRepeat     ?? ""} options={IMG_REPEAT_OPTIONS}     onChange={v => onChange({ ...value, imageRepeat: v })} />
      <BgOptionRow label="Attachment" value={value.imageAttachment ?? ""} options={IMG_ATTACHMENT_OPTIONS} onChange={v => onChange({ ...value, imageAttachment: v })} />
    </>
  );
}
