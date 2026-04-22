import { WebflowClient } from "webflow-api";
import { NextRequest, NextResponse } from "next/server";
import db from "../../../lib/utils/database";

/**
 * Callback API Route Handler
 * -------------------------
 * This route processes the OAuth callback from Webflow after a user authorizes the application.
 *
 * Flow:
 * 1. Receives authorization code from Webflow
 * 2. Exchanges code for access token
 * 3. Retrieves user's Webflow sites
 * 4. Stores site authorization details
 * 5. Handles response based on access method (popup vs direct)
 *
 * @param {NextRequest} request - The incoming request object containing:
 *   - searchParams: URL parameters including the authorization 'code'
 *   - headers: Request headers to determine if accessed via popup
 *
 * @returns {Promise<NextResponse>}
 *   - For popup windows: Returns HTML to close window and notify parent
 *   - For direct navigation: Redirects to the first authorized Webflow site
 *   - On error: Returns 400 status if no code provided
 *
 * @requires {WEBFLOW_CLIENT_ID} - Environment variable for OAuth client ID
 * @requires {WEBFLOW_CLIENT_SECRET} - Environment variable for OAuth client secret
 * @requires {APP_URL} - Base URL used for OAuth redirect (MUST match authorize route)
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const error = searchParams.get("error");
	const errorDescription = searchParams.get("error_description");

	if (error) {
		return NextResponse.json(
			{
				error,
				errorDescription: errorDescription || "Authorization failed",
			},
			{ status: 400 }
		);
	}

	if (!code) {
		return NextResponse.json({ error: "No code provided" }, { status: 400 });
	}

	try {
		if (!process.env.WEBFLOW_CLIENT_ID) {
			throw new Error("Missing WEBFLOW_CLIENT_ID");
		}

		if (!process.env.WEBFLOW_CLIENT_SECRET) {
			throw new Error("Missing WEBFLOW_CLIENT_SECRET");
		}

		if (!process.env.APP_URL) {
			throw new Error("Missing APP_URL");
		}

		const redirectUri = `${process.env.APP_URL}/api/auth/callback`;

		console.log("OAuth callback redirectUri:", redirectUri);

		// Get Access Token
		const accessToken = await WebflowClient.getAccessToken({
			clientId: process.env.WEBFLOW_CLIENT_ID,
			clientSecret: process.env.WEBFLOW_CLIENT_SECRET,
			code,
			redirectUri,
		});

		console.log("Access token received:", Boolean(accessToken));

		// Instantiate the Webflow Client
		const webflow = new WebflowClient({ accessToken });

		// Get Site ID to pair with the access token
		const sites = await webflow.sites.list();
		const authInfo = await webflow.token.introspect();

		console.log("Sites fetched:", sites?.sites?.length || 0);
		console.log(
			"Workspace IDs:",
			authInfo?.authorization?.authorizedTo?.workspaceIds ?? []
		);

		// Store site authorizations in parallel
		const siteList = sites?.sites ?? [];

		if (siteList.length > 0) {
			await Promise.all(
				siteList.map((site) => db.insertSiteAuthorization(site.id, accessToken))
			);
		}

		console.log("Site authorization records stored");

		// Check if the authorization request came from our Webflow designer extension
		const isAppPopup = searchParams.get("state") === "webflow_designer";
		console.log("isAppPopup", isAppPopup);

		// If the request is from a popup window, return HTML to close the window
		if (isAppPopup) {
			return new NextResponse(
				`<!DOCTYPE html>
				<html>
					<head>
						<title>Authorization Complete</title>
					</head>
					<body>
						<script>
							if (window.opener) {
								window.opener.postMessage('authComplete', '*');
							}
							window.close();
						</script>
					</body>
				</html>`,
				{
					headers: {
						"Content-Type": "text/html",
					},
				}
			);
		} else {
			// If authorized to the Workspace - redirect to the Dashboard
			const workspaceIds =
				authInfo?.authorization?.authorizedTo?.workspaceIds ?? [];

			if (workspaceIds.length > 0) {
				return NextResponse.redirect(
					`https://webflow.com/dashboard?workspace=${workspaceIds[0]}`
				);
			} else {
				// If authorized to the Site - redirect to the Designer Extension
				const firstSite = siteList[0];

				if (firstSite) {
					return NextResponse.redirect(
						`https://${firstSite.shortName}.design.webflow.com?app=${process.env.WEBFLOW_CLIENT_ID}`
					);
				}
			}
		}

		return NextResponse.json({ success: true });
	} catch (error: unknown) {
		console.error("Error in callback:", error);

		const message =
			error instanceof Error ? error.message : "Failed to process authorization";

		return NextResponse.json(
			{
				error: "Failed to process authorization",
				details: message,
			},
			{ status: 500 }
		);
	}
}