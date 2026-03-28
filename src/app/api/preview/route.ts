import { buildPreview, parseSpreadsheet, validateUpload } from "@/lib/dataset";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Upload a CSV or Excel file to continue." },
        { status: 400 },
      );
    }

    validateUpload(file);
    const parsedWorkbook = await parseSpreadsheet(file);
    const preview = buildPreview(parsedWorkbook);

    return Response.json(preview);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not inspect the uploaded file.";
    return Response.json({ error: message }, { status: 400 });
  }
}
