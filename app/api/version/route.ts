import { NextResponse } from "next/server";
import packageJson from "../../../package.json";
import { getAppEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Safe build/version metadata — deliberately minimal. Never includes a git
 * SHA, internal hostnames, dependency versions, or anything else useful to
 * an attacker fingerprinting this deployment beyond what `package.json`
 * already documents in the public source repository anyway.
 */
export async function GET() {
  return NextResponse.json({
    name: packageJson.name,
    version: packageJson.version,
    checkpoint: 6,
    appEnv: getAppEnv(),
  });
}
