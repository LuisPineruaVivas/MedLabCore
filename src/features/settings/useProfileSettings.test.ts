import { describe, expect, it } from "vitest";
import {
  buildProfileAssetPath,
  extractStoragePathFromUrl,
} from "./useProfileSettings";

describe("profile settings helpers", () => {
  it("builds a deterministic asset upload path", () => {
    expect(buildProfileAssetPath("user-123", "firma", "my-sign.png", 1700000000000)).toBe(
      "user-123/firma-1700000000000.png"
    );
    expect(buildProfileAssetPath("user-456", "sello", "stamp.jpg", 1700000000001)).toBe(
      "user-456/sello-1700000000001.jpg"
    );
  });

  describe("extractStoragePathFromUrl", () => {
    it("returns null for empty or undefined url", () => {
      expect(extractStoragePathFromUrl("", "firms_stamps")).toBeNull();
    });

    it("returns relative path as-is if already relative", () => {
      expect(extractStoragePathFromUrl("user-123/firma-123.png", "firms_stamps")).toBe(
        "user-123/firma-123.png"
      );
    });

    it("extracts path from standard Supabase public storage URL", () => {
      const url =
        "https://mgeateznuhmhgqemaphj.supabase.co/storage/v1/object/public/firms_stamps/226afc85-056b-4de5-ab8b-fe43334f7b0a/firma-1778295220034.png";
      expect(extractStoragePathFromUrl(url, "firms_stamps")).toBe(
        "226afc85-056b-4de5-ab8b-fe43334f7b0a/firma-1778295220034.png"
      );
    });

    it("extracts path from signed Supabase storage URL", () => {
      const url =
        "https://mgeateznuhmhgqemaphj.supabase.co/storage/v1/object/sign/firms_stamps/user-1/sello-123.png?token=xyz";
      expect(extractStoragePathFromUrl(url, "firms_stamps")).toBe("user-1/sello-123.png");
    });

    it("extracts path with URL encoded characters", () => {
      const url =
        "https://example.supabase.co/storage/v1/object/public/firms_stamps/user-1/firma%20final-123.png";
      expect(extractStoragePathFromUrl(url, "firms_stamps")).toBe("user-1/firma final-123.png");
    });

    it("handles fallback URLs containing the bucket name", () => {
      const url = "https://cdn.example.com/firms_stamps/user-99/sello-456.jpg?v=2";
      expect(extractStoragePathFromUrl(url, "firms_stamps")).toBe("user-99/sello-456.jpg");
    });

    it("returns null if bucket name is not in the URL", () => {
      const url = "https://other-domain.com/other-bucket/file.png";
      expect(extractStoragePathFromUrl(url, "firms_stamps")).toBeNull();
    });
  });
});
