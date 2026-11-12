import { describe, expect, it } from "vitest";
import { isSidebarShortcut } from "./sidebar-shortcut";

const base = {
  key: "b",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
};

describe("sidebar shortcut", () => {
  it("accepts Command+B on Mac", () => {
    expect(isSidebarShortcut({ ...base, metaKey: true })).toBe(true);
  });
  it("accepts Ctrl+B on Windows", () => {
    expect(isSidebarShortcut({ ...base, ctrlKey: true })).toBe(true);
  });
  it("ignores plain B and held-down or modified shortcuts", () => {
    expect(isSidebarShortcut(base)).toBe(false);
    expect(isSidebarShortcut({ ...base, ctrlKey: true, repeat: true })).toBe(false);
    expect(isSidebarShortcut({ ...base, metaKey: true, altKey: true })).toBe(false);
  });
});
