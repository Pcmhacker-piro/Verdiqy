import { describe, expect, it } from "vitest";
import { searchAccess } from "./search-access";

describe("search access", () => {
  it("does not redirect before the shared session is ready", () => {
    expect(searchAccess(false, false)).toBe("pending");
  });
  it("opens search immediately for a resolved signed-in user", () => {
    expect(searchAccess(true, true)).toBe("authenticated");
  });
  it("sends a resolved signed-out user to sign-in", () => {
    expect(searchAccess(true, false)).toBe("sign-in");
  });
});
