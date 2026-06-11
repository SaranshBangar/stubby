"use client";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

/**
 * Header account control. Signed out -> a "Sign in" link; signed in -> the
 * account email (links to /account) + a Sign out button. Renders nothing while
 * auth state is still loading to avoid a flash.
 */
export function AuthMenu() {
  const { user, loading, logout } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/account">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="max-w-[160px] truncate font-mono text-xs text-t2 hover:text-t1"
        title={user.email}
      >
        {user.email}
      </Link>
      <Button variant="ghost" size="sm" onClick={() => logout()}>
        Sign out
      </Button>
    </div>
  );
}
