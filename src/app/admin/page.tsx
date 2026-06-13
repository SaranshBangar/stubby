"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";

const ADMIN_EMAIL = "saranshbangad@gmail.com";

interface AdminUser {
  id: string;
  email: string;
  owner_token: string;
  created_at: number;
  pro_status: string | null;
  cf_order_id: string | null;
  mock_count: number;
  monitor_count: number;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(false);
  const [busyToken, setBusyToken] = useState<string | null>(null);

  const isAdmin = !loading && user?.email === ADMIN_EMAIL;

  async function fetchUsers() {
    setFetching(true);
    try {
      const data = await apiFetch<{ users: AdminUser[] }>("/api/admin/users");
      setUsers(data.users);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  async function togglePro(ownerToken: string, currentStatus: string | null) {
    setBusyToken(ownerToken);
    try {
      const action = currentStatus === "active" ? "revoke" : "grant";
      await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_token: ownerToken, action }),
      });
      await fetchUsers();
    } finally {
      setBusyToken(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader variant="tool" />
        <main className="mx-auto w-full max-w-5xl px-6 py-12">
          <p className="text-sm text-t2">Loading…</p>
        </main>
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader variant="tool" />
        <main className="mx-auto w-full max-w-5xl px-6 py-12 text-center">
          <p className="text-sm text-destructive">Access denied.</p>
        </main>
      </div>
    );
  }

  const totalMocks = users.reduce((s, u) => s + u.mock_count, 0);
  const totalMonitors = users.reduce((s, u) => s + u.monitor_count, 0);
  const proUsers = users.filter((u) => u.pro_status === "active").length;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="tool" />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-t1">
            Admin Dashboard
          </h1>
          <p className="mt-1 font-mono text-xs text-t3">
            Signed in as {user.email}
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Registered Users", value: users.length },
            { label: "Pro Users", value: proUsers },
            { label: "Total Mocks", value: totalMocks },
            { label: "Total Monitors", value: totalMonitors },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-md border border-b1 bg-s1 px-5 py-4 text-center"
            >
              <div className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] text-brand">
                {s.value}
              </div>
              <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-t3">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="rounded-md border border-b1 bg-s1">
          <div className="flex items-center justify-between border-b border-b1 px-5 py-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-t3">
              Registered Users
            </span>
            <button
              onClick={fetchUsers}
              disabled={fetching}
              className="font-mono text-[11px] text-brand hover:underline disabled:opacity-50"
            >
              {fetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {users.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-t3">
              {fetching ? "Loading…" : "No registered users yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-b1 text-left font-mono text-[10.5px] tracking-wider text-t3">
                    <th className="px-5 py-3">Email</th>
                    <th className="px-4 py-3">Mocks</th>
                    <th className="px-4 py-3">Monitors</th>
                    <th className="px-4 py-3">Pro</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-b1 last:border-0 hover:bg-s2"
                    >
                      <td className="px-5 py-3 font-medium text-t1">{u.email}</td>
                      <td className="px-4 py-3 font-mono text-t2">{u.mock_count}</td>
                      <td className="px-4 py-3 font-mono text-t2">{u.monitor_count}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-[2px] px-2 py-[2px] font-mono text-[11px] font-medium ${
                            u.pro_status === "active"
                              ? "bg-success/15 text-success"
                              : "bg-s3 text-t3"
                          }`}
                        >
                          {u.pro_status === "active" ? "Pro" : "Free"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-t3">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => togglePro(u.owner_token, u.pro_status)}
                          disabled={busyToken === u.owner_token}
                          className={`rounded-[3px] px-3 py-[5px] font-mono text-[11px] font-medium transition-colors disabled:opacity-50 ${
                            u.pro_status === "active"
                              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              : "bg-brand-dim text-brand hover:bg-brand/20"
                          }`}
                        >
                          {busyToken === u.owner_token
                            ? "…"
                            : u.pro_status === "active"
                              ? "Revoke Pro"
                              : "Grant Pro"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
