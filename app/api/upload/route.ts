import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 5_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new Error("Choose a JPEG, PNG, or WebP image under 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const jpeg = bytes[0] === 255 && bytes[1] === 216,
      png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      webp =
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
    if (!jpeg && !png && !webp)
      throw new Error("This file is not a supported image.");
    const name = `${crypto.randomUUID()}.${jpeg ? "jpg" : png ? "png" : "webp"}`;
    await mkdir(path.join(process.cwd(), "public/uploads"), {
      recursive: true,
    });
    await writeFile(path.join(process.cwd(), "public/uploads", name), bytes);
    return Response.json({ url: `/uploads/${name}` });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
