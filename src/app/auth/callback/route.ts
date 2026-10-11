import { NextResponse, type NextRequest } from "next/server";
import { createCloudServerClient } from "@/lib/cloud/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/account?auth=invalid", request.url));
  try {
    const supabase = await createCloudServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(new URL(error ? "/account?auth=failed" : "/account?auth=confirmed", request.url));
  } catch {
    return NextResponse.redirect(new URL("/account?auth=failed", request.url));
  }
}
