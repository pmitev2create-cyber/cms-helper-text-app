import { NextRequest, NextResponse } from "next/server";
import { listCollections } from "@/app/lib/controllers/collections";

export async function GET(request: NextRequest) {
	const siteId = request.nextUrl.searchParams.get("siteId");

	if (!siteId) {
		return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
	}

	try {
		const collections = await listCollections(siteId);

		return NextResponse.json({ collections });
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Failed to fetch collections";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}