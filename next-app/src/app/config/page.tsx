import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ConfigPageClient } from "@/components/config/config-page-client";

export default async function ConfigPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <ConfigPageClient />;
}
