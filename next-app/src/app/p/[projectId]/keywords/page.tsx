import { KeywordResearchForm } from "@/components/keywords/keyword-research-form";

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          GAP Analysis
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Find keywords by volume, difficulty and intent for this domain.
        </p>
      </div>
      <KeywordResearchForm />
    </div>
  );
}
