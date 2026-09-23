import { readFile } from "node:fs/promises";
import path from "node:path";

// Serve new uploads immediately, including after a production server has started.
export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name))
    return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(
      path.join(process.cwd(), "public/uploads", name),
    );
    return new Response(data, {
      headers: {
        "Content-Type": name.endsWith(".jpg")
          ? "image/jpeg"
          : name.endsWith(".png")
            ? "image/png"
            : "image/webp",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
