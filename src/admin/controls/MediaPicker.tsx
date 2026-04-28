import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaRef {
  id: string;
  storageKey: string;
  alt?: string;
  filename?: string;
}

interface ApiMediaItem {
  id: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  alt: string | null;
  status: string;
}

interface UploadState {
  uid: string;
  name: string;
  progress: number;
  done: boolean;
  error?: string;
  ref?: MediaRef;
}

export interface MediaPickerProps {
  multi?: boolean;
  mimeTypeFilter?: string;
  onSelect: (items: MediaRef[]) => void;
  onClose: () => void;
  selectedIds?: string[];
  title?: string;
  accept?: string;
}

// ─── Upload helper ─────────────────────────────────────────────────────────────

async function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<MediaRef> {
  const formData = new FormData();
  formData.append("file", file);

  const responseText = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/_emdash/api/media");
    xhr.setRequestHeader("X-EmDash-Request", "1");
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(formData);
  });

  onProgress(100);

  const json = JSON.parse(responseText) as { data?: { item?: { id: string; storageKey: string; filename: string } } };
  const item = json.data?.item;
  if (!item) throw new Error("Unexpected upload response");

  return { id: item.id, storageKey: item.storageKey, filename: item.filename };
}

// ─── MediaPicker ──────────────────────────────────────────────────────────────

export function MediaPicker({
  multi = false,
  mimeTypeFilter = "image/",
  onSelect,
  onClose,
  selectedIds = [],
  title,
  accept,
}: MediaPickerProps) {
  const [media, setMedia] = useState<{ items: ApiMediaItem[]; nextCursor?: string; loading: boolean }>(
    { items: [], nextCursor: undefined, loading: true },
  );
  const { items, nextCursor, loading } = media;
  const [selected, setSelected]     = useState<Set<string>>(new Set(selectedIds));
  const [uploads, setUploads]       = useState<UploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);

  const defaultTitle = multi ? "Select Files" : "Select File";
  const resolvedTitle = title ?? defaultTitle;
  const resolvedAccept = accept ?? (mimeTypeFilter.startsWith("video") ? "video/*" : "image/*");
  const isVideo = mimeTypeFilter.startsWith("video");

  // ── Load media ──────────────────────────────────────────────────────────────

  const loadMedia = useCallback((cursor?: string) => {
    const qs = `?mimeType=${encodeURIComponent(mimeTypeFilter)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    apiFetch(`/_emdash/api/media${qs}`)
      .then(res => parseApiResponse<{ items: ApiMediaItem[]; nextCursor?: string }>(res, "Failed to load media"))
      .then(data => setMedia(prev => ({
        loading: false,
        nextCursor: data.nextCursor,
        items: cursor ? [...prev.items, ...data.items] : data.items,
      })))
      .catch(e => { console.error(e); setMedia(prev => ({ ...prev, loading: false })); });
  }, [mimeTypeFilter]);

  useEffect(() => {
    let alive = true;
    const qs = `?mimeType=${encodeURIComponent(mimeTypeFilter)}`;
    apiFetch(`/_emdash/api/media${qs}`)
      .then(res => parseApiResponse<{ items: ApiMediaItem[]; nextCursor?: string }>(res, "Failed to load media"))
      .then(data => { if (alive) setMedia({ loading: false, items: data.items, nextCursor: data.nextCursor }); })
      .catch(e => { if (alive) { console.error(e); setMedia(prev => ({ ...prev, loading: false })); } });
    return () => { alive = false; };
  }, [mimeTypeFilter]);

  // ── Selection ───────────────────────────────────────────────────────────────

  const toggle = (item: ApiMediaItem) => {
    const ref: MediaRef = { id: item.id, storageKey: item.storageKey, alt: item.alt ?? undefined, filename: item.filename };
    if (!multi) {
      onSelect([ref]);
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) { next.delete(item.id); } else { next.add(item.id); }
      return next;
    });
  };

  const confirmMulti = () => {
    const known = items
      .filter(i => selected.has(i.id))
      .map(i => ({ id: i.id, storageKey: i.storageKey, alt: i.alt ?? undefined, filename: i.filename }));
    // include refs from uploads that are selected but not yet in items list
    const knownIds = new Set(known.map(r => r.id));
    const fromUploads = uploads
      .filter(u => u.done && !u.error && u.ref && selected.has(u.ref.id) && !knownIds.has(u.ref.id))
      .map(u => u.ref!);
    onSelect([...known, ...fromUploads]);
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith(mimeTypeFilter));
    if (!arr.length) return;

    for (const file of arr) {
      const uid = `${Date.now()}-${Math.random()}`;
      setUploads(prev => [...prev, { uid, name: file.name, progress: 0, done: false }]);

      uploadFile(file, pct => {
        setUploads(prev => prev.map(u => u.uid === uid ? { ...u, progress: pct } : u));
      }).then(ref => {
        setUploads(prev => prev.map(u => u.uid === uid ? { ...u, progress: 100, done: true, ref } : u));
        // auto-select uploaded item
        setSelected(prev => {
          const next = new Set(prev);
          next.add(ref.id);
          return next;
        });
        // add to grid
        setMedia(prev => ({ ...prev, items: [{
          id: ref.id,
          filename: ref.filename ?? file.name,
          mimeType: file.type,
          storageKey: ref.storageKey,
          alt: null,
          status: "ready",
        }, ...prev.items] }));
        // in single mode: auto-confirm immediately
        if (!multi) {
          onSelect([ref]);
        }
      }).catch(err => {
        setUploads(prev => prev.map(u => u.uid === uid ? { ...u, done: true, error: String(err) } : u));
      });
    }
  }, [mimeTypeFilter, multi, onSelect]);

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = (e: React.DragEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  // ── Pending upload count ────────────────────────────────────────────────────
  const inProgress = uploads.filter(u => !u.done);

  return createPortal(
    <div
      className="epx-media-picker"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={`epx-media-picker__panel${isDragOver ? " epx-media-picker__panel--drag" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Drop overlay */}
        {isDragOver && (
          <div className="epx-media-picker__drop-overlay">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4m0 0L8 8m4-4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Drop to upload
          </div>
        )}

        {/* Header */}
        <div className="epx-media-picker__header">
          <span className="epx-media-picker__title">{resolvedTitle}</span>
          <button
            type="button"
            className="epx-media-picker__upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
              <path d="M6 8V2m0 0L3.5 4.5M6 2l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 9v1.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Upload
          </button>
          <button type="button" className="epx-media-picker__close" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={resolvedAccept}
            multiple={multi}
            style={{ display: "none" }}
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="epx-media-picker__uploads">
            {uploads.map(u => (
              <div key={u.uid} className="epx-media-picker__upload-item">
                <span className="epx-media-picker__upload-name">{u.name}</span>
                {u.done ? (
                  u.error ? (
                    <span className="epx-media-picker__upload-error">Failed</span>
                  ) : (
                    <span className="epx-media-picker__upload-done">✓</span>
                  )
                ) : (
                  <div className="epx-media-picker__upload-bar">
                    <div className="epx-media-picker__upload-fill" style={{ width: `${u.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="epx-media-picker__body">
          {loading && items.length === 0 ? (
            <div className="epx-media-picker__empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="epx-media-picker__empty">
              No {isVideo ? "videos" : "images"} in Media library.
              <br />
              <span style={{ fontSize: 11, marginTop: 6, display: "block", opacity: 0.7 }}>
                Click Upload or drop files here.
              </span>
            </div>
          ) : (
            <>
              <div className="epx-media-picker__grid">
                {items.map(item => {
                  const isVid = item.mimeType.startsWith("video/");
                  return (
                    <div
                      key={item.id}
                      className={`epx-media-picker__item${selected.has(item.id) ? " is-selected" : ""}`}
                      onClick={() => toggle(item)}
                    >
                      {isVid ? (
                        <div className="epx-media-picker__video-thumb">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M7 5l9 5-9 5V5z" fill="currentColor"/>
                          </svg>
                        </div>
                      ) : (
                        <img
                          src={`/_emdash/api/media/file/${item.storageKey}`}
                          alt={item.alt ?? item.filename}
                          loading="lazy"
                        />
                      )}
                      <div className="epx-media-picker__item-check">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="epx-media-picker__item-name">{item.filename}</div>
                    </div>
                  );
                })}
              </div>
              {nextCursor && (
                <button
                  type="button"
                  className="epx-media-picker__load-more"
                  onClick={() => void loadMedia(nextCursor)}
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer (multi mode) */}
        {multi && (
          <div className="epx-media-picker__footer">
            {inProgress.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--epx-text-faint)", flex: 1 }}>
                Uploading {inProgress.length} file{inProgress.length !== 1 ? "s" : ""}…
              </span>
            )}
            <button type="button" className="epx-media-picker__cancel" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="epx-media-picker__confirm"
              onClick={confirmMulti}
              disabled={selected.size === 0}
            >
              Add{selected.size > 0 ? ` ${selected.size}` : ""} {isVideo ? "Video" : "Image"}{selected.size !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
