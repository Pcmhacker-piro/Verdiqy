import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  callback: undefined as undefined | ((event: string, session: unknown) => void),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: (callback: typeof mocks.callback) => {
        mocks.callback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  },
}));

import { createElement, type ReactNode } from "react";
import {
  CurrentUserProvider,
  notifyProfileUpdated,
  useCurrentUser,
  useCurrentUserStatus,
} from "./use-current-user";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(CurrentUserProvider, null, children);

const user = {
  id: "account-a",
  email: "account@example.test",
  user_metadata: { display_name: "Prakash Meena" },
};

describe("immediate account display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callback = undefined;
    mocks.getSession.mockResolvedValue({ data: { session: { user } } });
    mocks.maybeSingle.mockImplementation(() => new Promise(() => {}));
  });

  it("shows the signed-in account before the profile request finishes", async () => {
    const { result } = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(result.current?.name).toBe("Prakash Meena"));
    expect(result.current?.email).toBe("account@example.test");
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalled());
    expect(result.current?.initials).toBe("PM");
  });

  it("uses the sign-in event immediately without waiting for session retrieval", () => {
    mocks.getSession.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useCurrentUser(), { wrapper });
    act(() => mocks.callback?.("SIGNED_IN", { user }));
    expect(result.current?.name).toBe("Prakash Meena");
  });

  it("switches display identity immediately when a different account signs in", async () => {
    const { result } = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(result.current?.name).toBe("Prakash Meena"));
    act(() =>
      mocks.callback?.("SIGNED_IN", {
        user: {
          id: "account-b",
          email: "second@example.test",
          user_metadata: { display_name: "Second User" },
        },
      }),
    );
    expect(result.current?.name).toBe("Second User");
    expect(result.current?.email).toBe("second@example.test");
  });

  it("refreshes the shared name after a profile edit", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { display_name: "Prakash Meena" } });
    const { result } = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(1));
    mocks.maybeSingle.mockResolvedValue({ data: { display_name: "Updated Name" } });
    act(() => notifyProfileUpdated());
    await waitFor(() => expect(result.current?.name).toBe("Updated Name"));
  });

  it("does not restore the account from a late profile response after sign-out", async () => {
    let resolveProfile: ((value: unknown) => void) | undefined;
    mocks.maybeSingle.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
    );
    const { result } = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalled());
    act(() => mocks.callback?.("SIGNED_OUT", null));
    await act(async () => {
      resolveProfile?.({ data: { display_name: "Old profile" } });
    });
    expect(result.current).toBeNull();
  });

  it("distinguishes an unresolved session from a signed-out guest", async () => {
    mocks.getSession.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useCurrentUserStatus(), { wrapper });
    expect(result.current.ready).toBe(false);
    act(() => mocks.callback?.("INITIAL_SESSION", null));
    expect(result.current).toEqual({ user: null, ready: true });
  });

  it("shares one account and one profile request between sidebar consumers", async () => {
    const { result, rerender } = renderHook(() => [useCurrentUser(), useCurrentUser()], {
      wrapper,
    });
    await waitFor(() => expect(result.current[0]?.name).toBe("Prakash Meena"));
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(1));
    rerender();
    act(() => mocks.callback?.("SIGNED_IN", { user }));
    expect(result.current[1]?.name).toBe("Prakash Meena");
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
  });
});
