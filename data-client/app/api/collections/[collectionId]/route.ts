import { NextRequest, NextResponse } from "next/server";
import { getCollectionDetails } from "@/app/lib/controllers/collections";

export async function GET(
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

		return NextResponse.json(collection);
	} catch (error: unknown) {
		const message =
			error instanceof Error
				? error.message
				: "Failed to fetch collection details";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}