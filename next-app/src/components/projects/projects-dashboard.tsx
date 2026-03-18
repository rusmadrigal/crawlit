"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/components/providers/projects-provider";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Plus, Trash2 } from "lucide-react";

export function ProjectsDashboard() {
  const { projects, deleteProject } = useProjects();
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          Projects
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Each project tracks one domain. Create a project to start keyword research and SEO tools for that domain.
        </p>
      </div>

      {projects.length === 0 && !showNewForm && (
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

      {projects.length > 0 && (
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
                onClick={(e) => {
                  e.preventDefault();
                  if (window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                    deleteProject(project.id);
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
  );
}
