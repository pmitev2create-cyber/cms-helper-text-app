import { WebflowClient } from "webflow-api";
import { NextResponse } from "next/server";
import { OauthScope } from "webflow-api/api/types/OAuthScope";

const scopes = [
	"sites:read",
	"sites:write",,
	"authorized_user:read",
	"cms:read",
	"cms:write",
];

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const isDesigner = searchParams.get("state") === "webflow_designer";

	
	const authorizeUrl = WebflowClient.authorizeURL({
		scope: scopes as OauthScope[],
		clientId: process.env.WEBFLOW_CLIENT_ID!,
		state: isDesigner ? "webflow_designer" : undefined,
	});
	
	/* 
	const redirectUri = `${process.env.APP_URL}/api/auth/callback`;
	const authorizeUrl = WebflowClient.authorizeURL({
		scope: scopes as OauthScope[],
		clientId: process.env.WEBFLOW_CLIENT_ID!,
		redirectUri,
		state: isDesigner ? "webflow_designer" : undefined,
	}); */

	return NextResponse.redirect(authorizeUrl);
}