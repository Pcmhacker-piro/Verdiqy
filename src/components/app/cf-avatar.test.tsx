import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeforcesAvatar } from "./cf-avatar";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Codeforces avatar recovery", () => {
  it("tries the original uploaded picture when the main-site copy fails", () => {
    render(
      <CodeforcesAvatar
        handle="tourist"
        titlePhoto="https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg"
      />,
    );
    fireEvent.error(screen.getByAltText("tourist"));
    expect(screen.getByAltText("tourist").getAttribute("src")).toBe(
      "https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg",
    );
    fireEvent.error(screen.getByAltText("tourist"));
    expect(screen.getByAltText("tourist").getAttribute("src")).toBe(
      "/api/public/cf-avatar?url=https%3A%2F%2Fuserpic.codeforces.org%2F422%2Ftitle%2F50a270ed4a722867.jpg",
    );
  });

  it("starts with the new user's photo after a previous photo fails", () => {
    const { rerender } = render(
      <CodeforcesAvatar
        handle="tourist"
        titlePhoto="https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg"
      />,
    );
    fireEvent.error(screen.getByAltText("tourist"));
    rerender(
      <CodeforcesAvatar
        handle="Benq"
        titlePhoto="https://userpic.codeforces.org/312472/title/7cf0a442d4071e87.jpg"
      />,
    );
    expect(screen.getByAltText("Benq").getAttribute("src")).toBe(
      "https://codeforces.com/userpic/312472/title/7cf0a442d4071e87.jpg",
    );
  });

  it("moves past a stalled image host after three seconds", () => {
    vi.useFakeTimers();
    render(
      <CodeforcesAvatar
        handle="tourist"
        titlePhoto="https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg"
      />,
    );
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByAltText("tourist").getAttribute("src")).toBe(
      "https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg",
    );
    fireEvent.load(screen.getByAltText("tourist"));
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByAltText("tourist").getAttribute("src")).toBe(
      "https://userpic.codeforces.org/422/title/50a270ed4a722867.jpg",
    );
  });
});
