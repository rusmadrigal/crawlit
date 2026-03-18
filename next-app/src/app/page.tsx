import { ProjectsDashboard } from "@/components/projects/projects-dashboard";

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <ProjectsDashboard />
    </div>
  );
}
