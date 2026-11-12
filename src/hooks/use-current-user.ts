import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const PROFILE_UPDATED_EVENT = "verdiqy:profile-updated";

export function notifyProfileUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}

export interface CurrentUserInfo {
  name: string;
  initials: string;
  email: string | null;
  avatarUrl: string | null;
}

const CurrentUserContext = createContext<{ user: CurrentUserInfo | null; ready: boolean }>({
  user: null,
  ready: false,
});

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** One display-only identity for the entire app; route guards still own access. */
export function CurrentUserProvider({
  children,
  onIdentityChange,
}: {
  children: ReactNode;
  onIdentityChange?: (event: AuthChangeEvent) => void;
}) {
  const [state, setState] = useState<{ user: CurrentUserInfo | null; ready: boolean }>({
    user: null,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    let authChanged = false;
    let activeUser: User | null = null;
    let accountId: string | null = null;
    let profileTimer: ReturnType<typeof setTimeout> | undefined;

    function showUser(user: User | null, forceProfile = false) {
      activeUser = user;
      // Token refreshes and duplicate sign-in events must not refetch the profile.
      if (!forceProfile && user && accountId === user.id) return;
      const sameAccount = accountId === user?.id;
      accountId = user?.id ?? null;
      const currentRevision = ++revision;
      clearTimeout(profileTimer);
      if (!user) {
        if (!cancelled) setState({ user: null, ready: true });
        return;
      }
      const id = user.id;
      const email = user.email ?? null;
      const meta = user.user_metadata ?? {};
      let name =
        [meta.display_name, meta.full_name, meta.name].find(
          (value) => typeof value === "string" && value,
        ) ||
        email?.split("@")[0] ||
        "User";
      let avatarUrl: string | null =
        [meta.avatar_url, meta.picture].find((value) => typeof value === "string" && value) || null;
      if (!cancelled)
        setState((previous) => ({
          ready: true,
          user:
            sameAccount && previous.user
              ? previous.user
              : { name, initials: computeInitials(name), email, avatarUrl },
        }));

      profileTimer = setTimeout(() => {
        void loadProfile().catch(() => undefined);
      }, 0);
      async function loadProfile() {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, cf_title_photo")
          .eq("id", id)
          .maybeSingle();
        if (cancelled || revision !== currentRevision) return;
        if (profile?.display_name) name = profile.display_name;
        const stored = profile?.avatar_url;
        if (stored) {
          if (/^https?:\/\//i.test(stored)) avatarUrl = stored;
          else {
            const { data: signed } = await supabase.storage
              .from("avatars")
              .createSignedUrl(stored, 60 * 60 * 24);
            if (signed?.signedUrl) avatarUrl = signed.signedUrl;
          }
        } else if (!avatarUrl && profile?.cf_title_photo) avatarUrl = profile.cf_title_photo;
        if (!cancelled && revision === currentRevision)
          setState({
            ready: true,
            user: { name, initials: computeInitials(name), email, avatarUrl },
          });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== "INITIAL_SESSION" &&
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      )
        return;
      authChanged = true;
      showUser(session?.user ?? null, event === "USER_UPDATED");
      if (event !== "INITIAL_SESSION") onIdentityChange?.(event);
    });
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled && !authChanged) showUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!cancelled && !authChanged) setState({ user: null, ready: true });
      });
    const refreshProfile = () => showUser(activeUser, true);
    window.addEventListener(PROFILE_UPDATED_EVENT, refreshProfile);
    return () => {
      cancelled = true;
      revision++;
      clearTimeout(profileTimer);
      sub.subscription.unsubscribe();
      window.removeEventListener(PROFILE_UPDATED_EVENT, refreshProfile);
    };
  }, [onIdentityChange]);

  return createElement(CurrentUserContext.Provider, { value: state }, children);
}

export function useCurrentUser(): CurrentUserInfo | null {
  return useContext(CurrentUserContext).user;
}

export function useCurrentUserStatus() {
  return useContext(CurrentUserContext);
}
