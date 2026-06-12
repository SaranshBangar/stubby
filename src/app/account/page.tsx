"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { readOwnerToken } from "@/lib/useOwnerToken";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function AccountInner() {
  const { user, loading, login, register, logout } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const e = params.get("error");
    if (e) setError(e);
  }, [params]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      router.push("/mock?signed_in=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Carry the device's current anonymous token so Google sign-up can adopt it.
  function googleHref() {
    const t = readOwnerToken();
    return `/api/auth/google/start${t ? `?token=${encodeURIComponent(t)}` : ""}`;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="tool" />
      <main className="mx-auto w-full max-w-md px-6 py-12">
        {loading ? (
          <p className="text-sm text-t2">Loading…</p>
        ) : user ? (
          <Card className="bg-s1">
            <CardHeader className="border-b border-b1">
              <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-t3">
                Signed in
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <p className="text-[13.5px] text-t2">
                You&apos;re signed in as{" "}
                <span className="font-medium text-t1">{user.email}</span>. Your
                mocks, monitors and webhooks now sync across every device you
                sign in on.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => router.push("/mock")}>Open tools</Button>
                <Button variant="ghost" onClick={() => logout()}>
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-s1">
            <CardHeader className="border-b border-b1">
              <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-t3">
                {mode === "login" ? "Sign in" : "Create account"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <p className="text-[13px] text-t2">
                Optional - Stubby works with no account. Sign in to sync your
                work across devices.
              </p>

              <Button asChild variant="outline" className="w-full">
                <a href={googleHref()}>Continue with Google</a>
              </Button>

              <div className="flex items-center gap-3 text-[11px] text-t3">
                <span className="h-px flex-1 bg-b1" />
                or
                <span className="h-px flex-1 bg-b1" />
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {mode === "register" && (
                    <p className="text-[11px] text-t3">At least 8 characters.</p>
                  )}
                </div>

                {error && <p className="text-[12.5px] text-red-400">{error}</p>}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </Button>
              </form>

              <p className="text-center text-[12.5px] text-t2">
                {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-medium text-brand hover:underline"
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setError(null);
                  }}
                >
                  {mode === "login" ? "Create one" : "Sign in"}
                </button>
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function AccountPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AccountInner />
    </Suspense>
  );
}
