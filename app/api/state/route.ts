import { snapshot } from "@/lib/snapshot";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await snapshot());
}
