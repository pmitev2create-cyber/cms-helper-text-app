/**
 * External dependencies.
 */
import { NextRequest, NextResponse } from "next/server";
/**
 * Internal dependencies.
 */
import { getCollectionDetails } from "@/app/lib/controllers/collections";
import { generateHelpTextWithAI } from "@/app/lib/controllers/ai";

type CollectionFieldForGeneration = {
	id: string;
	displayName: string;
	slug: string;
	type: string;
	isRequired: boolean;
	helpText: string;
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
		const collection = await getCollectionDetails(collectionId, siteId);

		const fieldsWithoutHelpText = collection.fields
			.filter(
				(field: CollectionFieldForGeneration) =>
					!field.helpText || !field.helpText.trim()
			)
			.map((field: CollectionFieldForGeneration) => ({
				fieldId: field.id,
				displayName: field.displayName,
				slug: field.slug,
				type: field.type,
				isRequired: field.isRequired,
				currentHelpText: field.helpText || "",
			}));

		if (!fieldsWithoutHelpText.length) {
			return NextResponse.json({
				collectionId: collection.id,
				displayName: collection.displayName,
				fields: [],
			});
		}

		const aiSuggestions = await generateHelpTextWithAI(
			collection.displayName,
			fieldsWithoutHelpText
		);

		const fields = fieldsWithoutHelpText.map((field) => {
			const match = aiSuggestions.find((item) => item.fieldId === field.fieldId);

			return {
				fieldId: field.fieldId,
				displayName: field.displayName,
				currentHelpText: field.currentHelpText,
				suggestedHelpText: match?.suggestedHelpText || "",
			};
		});

		return NextResponse.json({
			collectionId: collection.id,
			displayName: collection.displayName,
			fields,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Failed to generate help text";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}