/**
 * External dependencies.
 */
import { NextRequest, NextResponse } from "next/server";

/**
 * Internal dependencies.
 */
import { updateCollectionFieldHelpText } from "@/app/lib/controllers/collections";

type ApplyHelpTextField = {
	fieldId: string;
	helpText: string;
};

type ApplyHelpTextRequestBody = {
	fields?: ApplyHelpTextField[];
};

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ collectionId: string }> }
) {
	const siteId = request.nextUrl.searchParams.get("siteId");

	if (!siteId) {
		return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
	}

	try {
		const { collectionId } = await params;
		const body = (await request.json()) as ApplyHelpTextRequestBody;
		const fields = Array.isArray(body?.fields) ? body.fields : [];

		if (!fields.length) {
			return NextResponse.json({ error: "No fields provided" }, { status: 400 });
		}

		const updatedFieldIds: string[] = [];

		for (const field of fields) {
			if (!field.fieldId || typeof field.helpText !== "string") {
				continue;
			}

			await updateCollectionFieldHelpText(
				collectionId,
				field.fieldId,
				field.helpText,
				siteId
			);

			updatedFieldIds.push(field.fieldId);
		}

		return NextResponse.json({
			success: true,
			updatedFieldIds,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Failed to apply help text";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}