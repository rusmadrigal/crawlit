"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, ArrowLeft, Users } from "lucide-react";

type Project = { id: string; name: string; domain: string };
type UserRow = {
  id: string;
  username: string;
  role: string;
  projectIds: string[];
  projects: Project[];
};

export function AdminDashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/projects"),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (pRes.ok) {
        const data = await pRes.json();
        setProjects(data.map((p: { id: string; name: string; domain: string }) => ({ id: p.id, name: p.name, domain: p.domain })));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="size-8 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-12" style={{ backgroundColor: "var(--background)" }}>
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
            Administration
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Create users and assign projects
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="size-4" />
          New user
        </Button>
      </div>

      {showForm && (
        <CreateUserForm
          projects={projects}
          onSuccess={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Users
          </CardTitle>
          <CardDescription>Users and assigned projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No users yet. Create one to get started.
              </p>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  allProjects={projects}
                  onUpdate={load}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateUserForm({
  projects,
  onSuccess,
  onCancel,
}: {
  projects: Project[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, projectIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create user");
        return;
      }
      onSuccess();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New user</CardTitle>
        <CardDescription>Username, password and assigned projects</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              disabled={loading}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              required
              minLength={6}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Assigned projects
            </label>
            {projects.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                No projects yet. Create projects first from the dashboard.
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) =>
                        setProjectIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                        )
                      }
                    />
                    <span className="text-sm">{p.name}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      ({p.domain})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {error && (
            <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Create user"}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({
  user,
  allProjects,
  onUpdate,
}: {
  user: UserRow;
  allProjects: Project[];
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [projectIds, setProjectIds] = useState<string[]>(user.projectIds);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/projects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds }),
      });
      if (res.ok) {
        setEditing(false);
        onUpdate();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium" style={{ color: "var(--foreground)" }}>
            {user.username}
          </span>
          <span className="ml-2 rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--muted-bg)", color: "var(--muted)" }}>
            {user.role}
          </span>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit projects
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setProjectIds(user.projectIds);
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
          {allProjects.map((p) => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={projectIds.includes(p.id)}
                onChange={(e) =>
                  setProjectIds((prev) =>
                    e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                  )
                }
              />
              {p.name} ({p.domain})
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          {user.projects.length === 0
            ? "No projects assigned"
            : user.projects.map((p) => p.name).join(", ")}
        </p>
      )}
    </div>
  );
}
