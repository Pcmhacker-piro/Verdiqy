/** Display routing only; authenticated server functions remain the security boundary. */
export function searchAccess(
  ready: boolean,
  hasUser: boolean,
): "pending" | "authenticated" | "sign-in" {
  if (!ready) return "pending";
  return hasUser ? "authenticated" : "sign-in";
}
