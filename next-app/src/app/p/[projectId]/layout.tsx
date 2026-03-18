import { ProjectLayoutClient } from "@/components/layout/project-layout-client";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectLayoutClient projectId={projectId}>{children}</ProjectLayoutClient>;
}
