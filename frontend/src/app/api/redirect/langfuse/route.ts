import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const hostname = host?.split(":")[0] || "localhost";
  return NextResponse.redirect(`http://${hostname}:3000`);
}
