export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
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

function getAllowedOrigin(request: NextRequest): string {
	const origin = request.headers.get("origin") || "";

	const allowedOrigins = [
		"http://localhost:1337",
		"http://localhost:5173",
		process.env.DESIGNER_EXTENSION_URI,
	].filter(Boolean) as string[];

	if (allowedOrigins.includes(origin)) {
		return origin;
	}

	return allowedOrigins[0] || "*";
}

function withCors(request: NextRequest, response: NextResponse): NextResponse {
	const allowedOrigin = getAllowedOrigin(request);

	response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
	response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	response.headers.set("Access-Control-Allow-Credentials", "true");

	return response;
}

export async function OPTIONS(request: NextRequest) {
	return withCors(request, new NextResponse(null, { status: 204 }));
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ collectionId: string }> }
) {
	const siteId = request.nextUrl.searchParams.get("siteId");

	if (!siteId) {
		return withCors(
			request,
			NextResponse.json({ error: "Missing siteId" }, { status: 400 })
		);
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
			return withCors(
				request,
				NextResponse.json({
					collectionId: collection.id,
					displayName: collection.displayName,
					fields: [],
				})
			);
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

		return withCors(
			request,
			NextResponse.json({
				collectionId: collection.id,
				displayName: collection.displayName,
				fields,
			})
		);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Failed to generate help text";

		console.error("Generate help text route error:", error);

		return withCors(
			request,
			NextResponse.json({ error: message }, { status: 500 })
		);
	}
}