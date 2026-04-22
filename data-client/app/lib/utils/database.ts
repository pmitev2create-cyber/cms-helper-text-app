import { kv } from "@vercel/kv";

/**
 * Database Utility (Vercel KV)
 * ---------------------------
 * Stores OAuth tokens using Vercel KV (Upstash under the hood)
 *
 * Keys:
 * - site:{siteId} -> accessToken
 * - user:{userId} -> accessToken
 */

export async function insertSiteAuthorization(
	siteId: string,
	accessToken: string
): Promise<void> {
	await kv.set(`site:${siteId}`, accessToken);
	console.log("Site authorization stored");
}

export async function insertUserAuthorization(
	userId: string,
	accessToken: string
): Promise<void> {
	await kv.set(`user:${userId}`, accessToken);
	console.log("User authorization stored");
}

export async function getAccessTokenFromSiteId(
	siteId: string
): Promise<string> {
	const token = await kv.get<string>(`site:${siteId}`);

	if (!token) {
		throw new Error("No access token found for site");
	}

	return token;
}

export async function getAccessTokenFromUserId(
	userId: string
): Promise<string> {
	const token = await kv.get<string>(`user:${userId}`);

	if (!token) {
		throw new Error("No access token found for user");
	}

	return token;
}

export async function clearDatabase(): Promise<void> {
	const siteKeys = await kv.keys("site:*");
	const userKeys = await kv.keys("user:*");

	const keys = [...siteKeys, ...userKeys];

	if (keys.length > 0) {
		await kv.del(...keys);
	}

	console.log("Database cleared");
}

const database = {
	insertSiteAuthorization,
	insertUserAuthorization,
	getAccessTokenFromSiteId,
	getAccessTokenFromUserId,
	clearDatabase,
};

export default database;