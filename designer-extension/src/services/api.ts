const API_BASE = "http://localhost:3000";
// const API_BASE = import.meta.env.VITE_API_BASE_URL;

export type CollectionListItem = {
	id: string;
	displayName: string;
	slug: string;
};

export type CmsField = {
	id: string;
	displayName: string;
	slug: string;
	type: string;
	isRequired: boolean;
	helpText: string;
	isEditable?: boolean;
};

export type CmsCollection = {
	id: string;
	displayName: string;
	slug: string;
	fields: CmsField[];
};

export type GeneratedFieldHelpText = {
	fieldId: string;
	displayName: string;
	currentHelpText: string;
	suggestedHelpText: string;
};

export async function getCollections(siteId: string): Promise<{ collections: CollectionListItem[] }> {
	const response = await fetch(
		`${API_BASE}/api/collections?siteId=${encodeURIComponent(siteId)}`,
		{
			method: "GET",
			credentials: "include",
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(errorText || "Failed to fetch collections");
	}

	const text = await response.text();
	console.log("API raw response:", text);

	if (!response.ok) {
		throw new Error(text || "Request failed");
	}

	return JSON.parse(text);
}

export async function getCollection(collectionId: string, siteId: string): Promise<CmsCollection> {
	const response = await fetch(
		`${API_BASE}/api/collections/${encodeURIComponent(collectionId)}?siteId=${encodeURIComponent(siteId)}`,
		{
			method: "GET",
			credentials: "include",
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(errorText || "Failed to fetch collection details");
	}

	return response.json();
}

export async function generateHelpText(
	collectionId: string,
	siteId: string
): Promise<{
	collectionId: string;
	displayName: string;
	fields: GeneratedFieldHelpText[];
}> {
	const response = await fetch(
		`${API_BASE}/api/collections/${encodeURIComponent(collectionId)}/generate-help-text?siteId=${encodeURIComponent(siteId)}`,
		{
			method: "POST",
			credentials: "include",
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(errorText || "Failed to generate help text");
	}

	return response.json();
}

export async function applyHelpText(
	collectionId: string,
	siteId: string,
	fields: Array<{ fieldId: string; helpText: string }>
): Promise<{
	success: boolean;
	updatedFieldIds: string[];
}> {
	const response = await fetch(
		`${API_BASE}/api/collections/${encodeURIComponent(collectionId)}/apply-help-text?siteId=${encodeURIComponent(siteId)}`,
		{
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ fields }),
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(errorText || "Failed to apply help text");
	}

	return response.json();
}