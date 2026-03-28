import { NextResponse } from "next/server";

import { buildPreview, parseSpreadsheet, validateUpload } from "@/lib/dataset";
import { storePreviewSession } from "@/lib/session-store";

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

    return NextResponse.json(
      await storePreviewSession({
        parsedWorkbook,
        preview,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not inspect the uploaded file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
