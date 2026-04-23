import db from "@/app/lib/utils/database";

const WEBFLOW_API_BASE = "https://api.webflow.com/v2";

export type WebflowCollectionListItem = {
	id: string;
	displayName: string;
	slug: string;
};

export type WebflowCollectionField = {
	id: string;
	displayName: string;
	slug: string;
	type: string;
	isRequired: boolean;
	helpText: string;
	isEditable?: boolean;
};

export type WebflowCollectionDetails = {
	id: string;
	displayName: string;
	slug: string;
	fields: WebflowCollectionField[];
};

type WebflowListCollectionsResponse = {
	collections?: Array<{
		id: string;
		displayName: string;
		slug: string;
	}>;
};

type WebflowGetCollectionResponse = {
	id: string;
	displayName: string;
	slug: string;
	fields?: Array<{
		id: string;
		displayName: string;
		slug: string;
		type: string;
		isRequired: boolean;
		helpText?: string;
		isEditable?: boolean;
	}>;
};

async function getAccessToken(siteId: string): Promise<string> {
	return db.getAccessTokenFromSiteId(siteId);
}

function isSiteNotAuthorizedError(errorText: string): boolean {
	return (
		errorText.includes(`"code":"resource_not_found"`) ||
		errorText.includes(`"code": "resource_not_found"`) ||
		errorText.includes("The site cannot be found")
	);
}

async function handleWebflowError(siteId: string, errorText: string): Promise<never> {
	if (isSiteNotAuthorizedError(errorText)) {
		await db.clearSiteAuthorization(siteId);

		throw new Error(
			"This site is not authorized for the app. Please authorize the app for this site again."
		);
	}

	throw new Error(`Webflow API error: ${errorText}`);
}

export async function listCollections(
	siteId: string
): Promise<WebflowCollectionListItem[]> {
	const accessToken = await getAccessToken(siteId);

	const response = await fetch(
		`${WEBFLOW_API_BASE}/sites/${siteId}/collections`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		await handleWebflowError(siteId, errorText);
	}

	const data = (await response.json()) as WebflowListCollectionsResponse;

	return (data.collections || []).map((collection) => ({
		id: collection.id,
		displayName: collection.displayName,
		slug: collection.slug,
	}));
}

export async function getCollectionDetails(
	collectionId: string,
	siteId: string
): Promise<WebflowCollectionDetails> {
	const accessToken = await getAccessToken(siteId);

	const response = await fetch(
		`${WEBFLOW_API_BASE}/collections/${collectionId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		await handleWebflowError(siteId, errorText);
	}

	const data = (await response.json()) as WebflowGetCollectionResponse;

	return {
		id: data.id,
		displayName: data.displayName,
		slug: data.slug,
		fields: (data.fields || []).map((field) => ({
			id: field.id,
			displayName: field.displayName,
			slug: field.slug,
			type: field.type,
			isRequired: field.isRequired,
			helpText: field.helpText || "",
			isEditable: field.isEditable,
		})),
	};
}

export async function updateCollectionFieldHelpText(
	collectionId: string,
	fieldId: string,
	helpText: string,
	siteId: string
) {
	const accessToken = await getAccessToken(siteId);

	const response = await fetch(
		`${WEBFLOW_API_BASE}/collections/${collectionId}/fields/${fieldId}`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				helpText,
			}),
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		await handleWebflowError(siteId, errorText);
	}

	return response.json();
}