import React from "react";
import {
  BgNumRow,
  BgOptionRow,
  BgToggleRow,
  IconClose,
  IconImage,
  IconVideo,
  IMG_POSITION_OPTIONS,
  IMG_SIZE_OPTIONS,
} from "./common.js";
import type { BackgroundConfig } from "./serialize.js";

/**
 * Video mode body — Media / URL toggle, video media row or url
 * input, size / position / start-time / end-time / play-once rows,
 * and the fallback poster picker.
 *
 * Extracted in F4.7 from `BackgroundControl.tsx`. The media-picker
 * modal lives in the parent and is dispatched via two callbacks:
 * `openMainPicker()` (sets the primary video) and
 * `openFallbackPicker()` (sets the poster image).
 */
interface Props {
  value: BackgroundConfig;
  onChange: (next: BackgroundConfig) => void;
  openMainPicker: () => void;
  openFallbackPicker: () => void;
}

export function VideoSub({ value, onChange, openMainPicker, openFallbackPicker }: Props) {
  return (
    <>
      <div className="epx-bg-ctrl__src-toggle">
        <button
          type="button"
          className={`epx-bg-ctrl__src-btn${(value.videoSrc ?? "media") === "media" ? " is-active" : ""}`}
          onClick={() => onChange({ ...value, videoSrc: "media" })}
        >
          Media
        </button>
        <button
          type="button"
          className={`epx-bg-ctrl__src-btn${value.videoSrc === "url" ? " is-active" : ""}`}
          onClick={() => onChange({ ...value, videoSrc: "url" })}
        >
          URL
        </button>
      </div>

      {(value.videoSrc ?? "media") === "media" && (
        <div className="epx-bg-ctrl__media-row">
          <div className="epx-bg-ctrl__thumb-placeholder"><IconVideo /></div>
          <span className="epx-bg-ctrl__media-name">{value.videoMedia?.filename ?? "No video selected"}</span>
          <button type="button" className="epx-bg-ctrl__media-btn" onClick={openMainPicker}>
            {value.videoMedia ? "Change" : "Select"}
          </button>
          {value.videoMedia && (
            <button type="button" className="epx-bg-ctrl__stop-remove" onClick={() => onChange({ ...value, videoMedia: undefined })} title="Clear">
              <IconClose />
            </button>
          )}
        </div>
      )}

      {value.videoSrc === "url" && (
        <div className="epx-bg-ctrl__url-row">
          <span className="epx-bg-ctrl__stop-label">URL</span>
          <input
            type="url"
            className="epx-bg-ctrl__url-input"
            value={value.videoUrl ?? ""}
            placeholder="YouTube|Vimeo|.mp4|.webm|.mov"
            onChange={e => onChange({ ...value, videoUrl: e.target.value })}
          />
        </div>
      )}

      <BgOptionRow label="Size"       value={value.videoSize     ?? ""} options={IMG_SIZE_OPTIONS}     onChange={v => onChange({ ...value, videoSize: v })} />
      <BgOptionRow label="Position"   value={value.videoPosition ?? ""} options={IMG_POSITION_OPTIONS} onChange={v => onChange({ ...value, videoPosition: v })} />
      <BgNumRow    label="Start Time" value={value.videoStartTime} onChange={v => onChange({ ...value, videoStartTime: v })} />
      <BgNumRow    label="End Time"   value={value.videoEndTime}   onChange={v => onChange({ ...value, videoEndTime: v })} />
      <BgToggleRow label="Play Once"  value={value.videoPlayOnce ?? false} onChange={v => onChange({ ...value, videoPlayOnce: v })} />

      <div className="epx-side-input">
        <span className="epx-side-input__label epx-side-input__label--row epx-row-label--section">Fallback</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto", paddingRight: 6 }}>
          {value.videoFallback?.storageKey ? (
            <img
              className="epx-bg-ctrl__thumb"
              src={`/_emdash/api/media/file/${value.videoFallback.storageKey}`}
              alt={value.videoFallback.filename ?? ""}
            />
          ) : (
            <div className="epx-bg-ctrl__thumb-placeholder"><IconImage /></div>
          )}
          <button type="button" className="epx-bg-ctrl__media-btn" onClick={openFallbackPicker}>
            {value.videoFallback ? "Change" : "Select"}
          </button>
          {value.videoFallback && (
            <button type="button" className="epx-bg-ctrl__stop-remove" onClick={() => onChange({ ...value, videoFallback: undefined })} title="Clear">
              <IconClose />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
