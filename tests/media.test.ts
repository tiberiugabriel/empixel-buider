import { describe, it, expect, vi } from "vitest";
import { resolveMediaUrl } from "../src/components/media.js";

describe("resolveMediaUrl", () => {
  it("returns null when key is missing", () => {
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl("")).toBeNull();
  });

  it("falls back to legacy local route when no adapter is present", () => {
    expect(resolveMediaUrl("file-abc.png")).toBe(
      "/_emdash/api/media/file/file-abc.png",
    );
  });

  it("URL-encodes the key in the fallback path", () => {
    expect(resolveMediaUrl("with spaces & slash/foo.png")).toBe(
      "/_emdash/api/media/file/with%20spaces%20%26%20slash%2Ffoo.png",
    );
  });

  it("uses the adapter's getPublicMediaUrl when present", () => {
    const getPublicMediaUrl = vi.fn(
      (key: string) => `https://cdn.example.com/media/${key}?v=1`,
    );
    const url = resolveMediaUrl("img-1.jpg", {
      locals: { emdash: { getPublicMediaUrl } },
    });
    expect(getPublicMediaUrl).toHaveBeenCalledWith("img-1.jpg");
    expect(url).toBe("https://cdn.example.com/media/img-1.jpg?v=1");
  });

  it("falls back to the legacy URL when the adapter returns undefined", () => {
    const getPublicMediaUrl = vi.fn(() => undefined);
    expect(
      resolveMediaUrl("img-1.jpg", {
        locals: { emdash: { getPublicMediaUrl } },
      }),
    ).toBe("/_emdash/api/media/file/img-1.jpg");
    expect(getPublicMediaUrl).toHaveBeenCalledWith("img-1.jpg");
  });

  it("falls back when the adapter shape is partial (no getPublicMediaUrl)", () => {
    expect(
      resolveMediaUrl("img-1.jpg", {
        locals: { emdash: {} },
      }),
    ).toBe("/_emdash/api/media/file/img-1.jpg");
  });

  it("falls back when locals is empty", () => {
    expect(resolveMediaUrl("img-1.jpg", { locals: {} })).toBe(
      "/_emdash/api/media/file/img-1.jpg",
    );
  });
});
