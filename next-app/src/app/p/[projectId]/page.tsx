import { ProjectOverviewDashboard } from "@/components/projects/project-overview-dashboard";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectOverviewDashboard projectId={projectId} />;
}
