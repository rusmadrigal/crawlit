import { NextResponse } from "next/server";
import { isDataforseoConfigured } from "@/lib/dataforseo";

export async function GET() {
  return NextResponse.json({
    dataforseoConfigured: isDataforseoConfigured(),
  });
}
