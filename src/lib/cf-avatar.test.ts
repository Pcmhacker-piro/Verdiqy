import { describe, expect, it } from "vitest";
import { cfAvatarSources } from "./cf-avatar";

describe("Codeforces uploaded photos", () => {
  it("uses the official main-site copy of the exact uploaded image", () => {
    expect(cfAvatarSources("https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg")).toEqual([
      "https://codeforces.com/userpic/422/title/50a270ed4a722867.jpg",
      "https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg",
    ]);
  });
  it("accepts protocol-relative Codeforces photos", () => {
    expect(cfAvatarSources("//userpic.codeforces.org/422/avatar/photo.jpg")[0]).toBe(
      "https://codeforces.com/userpic/422/avatar/photo.jpg",
    );
  });
  it("rejects unrelated hosts and insecure URLs", () => {
    for (const url of ["https://example.com/image.jpg", "http://userpic.codeforces.org/422/avatar/photo.jpg", "https://codeforces.com.evil.com/image.jpg"]) {
      expect(() => cfAvatarSources(url)).toThrow();
    }
  });
});