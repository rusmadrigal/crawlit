"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Project } from "@/types/project";
import { getProjects, addProject as addProjectStorage, getProjectById, deleteProject as deleteProjectStorage } from "@/lib/projects";

type ProjectsContextValue = {
  projects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  addProject: (domain: string, name?: string) => Project;
  deleteProject: (id: string) => void;
  refreshProjects: () => void;
};

const ProjectsContext = React.createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);

  const refreshProjects = React.useCallback(() => {
    setProjects(getProjects());
  }, []);

  React.useEffect(() => {
    setProjects(getProjects());
  }, [pathname]);

  const currentProjectId = React.useMemo(() => {
    const match = pathname?.match(/^\/p\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const currentProject = currentProjectId ? getProjectById(currentProjectId) ?? null : null;

  const addProject = React.useCallback(
    (domain: string, name?: string) => {
      const project = addProjectStorage(domain, name);
      setProjects(getProjects());
      return project;
    },
    []
  );

  const deleteProject = React.useCallback(
    (id: string) => {
      deleteProjectStorage(id);
      setProjects(getProjects());
      if (currentProjectId === id) {
        router.push("/");
      }
    },
    [currentProjectId, router]
  );

  const value = React.useMemo<ProjectsContextValue>(
    () => ({
      projects,
      currentProjectId,
      currentProject,
      addProject,
      deleteProject,
      refreshProjects,
    }),
    [projects, currentProjectId, currentProject, addProject, deleteProject, refreshProjects]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = React.useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
