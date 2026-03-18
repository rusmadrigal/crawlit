import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, ArrowUpRight, Compass, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";

export default function AiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          AI
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Use AI with your SEO data. Connect Claude Code or other tools via the DataForSEO MCP.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              DataForSEO MCP
            </CardTitle>
            <CardDescription>
              Official DataForSEO MCP server for AI assistants (Claude, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="https://dataforseo.com/help-center/setting-up-the-official-dataforseo-mcp-server-simple-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              Setup guide
              <ArrowUpRight className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="size-4" />
              AI-native workflows
            </CardTitle>
            <CardDescription>
              Rank tracking and content workflows coming soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
