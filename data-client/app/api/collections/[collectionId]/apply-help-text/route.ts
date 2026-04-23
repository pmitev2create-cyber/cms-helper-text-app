export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { updateCollectionFieldHelpText } from "@/app/lib/controllers/collections";

type ApplyHelpTextField = {
	fieldId: string;
	helpText: string;
};

type ApplyHelpTextRequestBody = {
	fields?: ApplyHelpTextField[];
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
		const body = (await request.json()) as ApplyHelpTextRequestBody;
		const fields = Array.isArray(body?.fields) ? body.fields : [];

		if (!fields.length) {
			return withCors(
				request,
				NextResponse.json({ error: "No fields provided" }, { status: 400 })
			);
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

		return withCors(
			request,
			NextResponse.json({
				success: true,
				updatedFieldIds,
			})
		);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Failed to apply help text";

		return withCors(
			request,
			NextResponse.json({ error: message }, { status: 500 })
		);
	}
}