"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/components/providers/projects-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Loader2, Plus, Trash2, LogOut, Settings, SlidersHorizontal } from "lucide-react";

export function ProjectsDashboard() {
  const { projects, projectsLoaded, deleteProject } = useProjects();
  const { user, logout } = useAuth();
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="font-semibold" style={{ color: "var(--foreground)" }}>
          CrawliT
        </Link>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <span className="text-sm" style={{ color: "var(--muted)" }}>{user.username}</span>
              <Link href="/config">
                <Button variant="ghost" size="sm" className="gap-1">
                  <SlidersHorizontal className="size-4" />
                  Settings
                </Button>
              </Link>
              {user.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Settings className="size-4" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={logout} className="gap-1">
                <LogOut className="size-4" />
                Log out
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          Projects
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Each project tracks one domain. Create a project to start keyword research and SEO tools for that domain.
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--muted)", opacity: 0.9 }}>
          Projects are stored in your account. Only you and admins can see your projects.
        </p>
      </div>

      {!projectsLoaded && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
          </CardContent>
        </Card>
      )}

      {projectsLoaded && projects.length === 0 && !showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-5" />
              Create your first project
            </CardTitle>
            <CardDescription>
              Add a domain (e.g. example.com) to get a dedicated workspace for keyword research, backlinks, and audits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewProjectForm submitLabel="Create project" />
          </CardContent>
        </Card>
      )}

      {projectsLoaded && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="relative transition-shadow hover:shadow-md">
              <Link href={`/p/${project.id}`} className="block">
                <CardHeader className="pb-2 pr-10">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="size-4 text-[var(--muted)]" />
                    {project.name}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">{project.domain}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-[var(--primary)]">Open project →</span>
                </CardContent>
              </Link>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  if (window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                    await deleteProject(project.id);
                  }
                }}
                className="absolute right-3 top-3 rounded p-1.5 text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-600"
                title="Delete project"
                aria-label={`Delete ${project.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--muted-bg)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Plus className="mb-2 size-8" style={{ color: "var(--muted)" }} aria-hidden />
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              New project
            </span>
          </button>
        </div>
      )}

      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle>New project</CardTitle>
            <CardDescription>Add a domain to create a dedicated workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewProjectForm
              showCancel
              onCancel={() => setShowNewForm(false)}
              onSuccess={() => setShowNewForm(false)}
            />
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
