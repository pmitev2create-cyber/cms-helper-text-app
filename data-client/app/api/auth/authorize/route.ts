import { WebflowClient } from "webflow-api";
import { NextResponse } from "next/server";
import { OauthScope } from "webflow-api/api/types/OAuthScope";

const scopes = [
	"sites:read",
	"sites:write",
	"authorized_user:read",
	"cms:read",
	"cms:write",
].filter(Boolean);

export async function GET(request: Request) {
	if (!process.env.WEBFLOW_CLIENT_ID) {
		return NextResponse.json(
			{ error: "Missing WEBFLOW_CLIENT_ID" },
			{ status: 500 }
		);
	}

	if (!process.env.APP_URL) {
		return NextResponse.json(
			{ error: "Missing APP_URL" },
			{ status: 500 }
		);
	}
	
	const { searchParams } = new URL(request.url);
	const isDesigner = searchParams.get("state") === "webflow_designer";
	const redirectUri = `${process.env.APP_URL}/api/auth/callback`;

	console.log("AUTHORIZE APP_URL:", JSON.stringify(process.env.APP_URL));
	console.log("AUTHORIZE redirectUri:", JSON.stringify(redirectUri));

	const authorizeUrl = WebflowClient.authorizeURL({
		clientId: process.env.WEBFLOW_CLIENT_ID,
		redirectUri,
		scope: scopes as OauthScope[],
		state: isDesigner ? "webflow_designer" : undefined,
	});

	console.log("AUTHORIZE URL:", authorizeUrl);
	
	return NextResponse.redirect(authorizeUrl);
}