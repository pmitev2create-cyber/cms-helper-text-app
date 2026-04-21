import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY,
});

type InputField = {
	fieldId: string;
	displayName: string;
	slug: string;
	type: string;
	isRequired: boolean;
	currentHelpText: string;
};

type OutputField = {
	fieldId: string;
	suggestedHelpText: string;
};

type GeminiResponseShape = {
	fields: OutputField[];
};

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiJson(text: string): GeminiResponseShape {
	const cleanedText = text
		.replace(/^```json\s*/i, "")
		.replace(/^```\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();

	const firstBraceIndex = cleanedText.indexOf("{");
	const lastBraceIndex = cleanedText.lastIndexOf("}");

	const normalizedText =
		firstBraceIndex !== -1 && lastBraceIndex !== -1
			? cleanedText.slice(firstBraceIndex, lastBraceIndex + 1)
			: cleanedText;

	const parsed = JSON.parse(normalizedText) as GeminiResponseShape;

	if (!Array.isArray(parsed.fields)) {
		throw new Error("Gemini response does not contain a valid fields array");
	}

	return parsed;
}

async function callGeminiModel(
	model: string,
	collectionName: string,
	fields: InputField[]
): Promise<OutputField[]> {
	const prompt = `
Return only valid JSON.
No markdown.
No explanation.
No code fences.

Use exactly this shape:
{
	"fields": [
		{
			"fieldId": "string",
			"suggestedHelpText": "string"
		}
	]
}

You are generating Webflow CMS helper text for content editors.

Collection name:
${collectionName}

Rules:
- Return one result for each input field
- Keep helper text short, practical, and specific
- Usually 1 sentence
- Do not repeat the field name unless needed
- Mention formatting expectations only when useful
- For SEO fields, explain the SEO purpose
- For image fields, explain what kind of image should be uploaded

Input fields:
${JSON.stringify(fields, null, 2)}
`.trim();

	const response = await ai.models.generateContent({
		model,
		contents: prompt,
	});

	const text = response.text;

	if (!text) {
		throw new Error("Gemini returned empty content");
	}

	const parsed = parseGeminiJson(text);
	return parsed.fields;
}

export async function generateHelpTextWithAI(
	collectionName: string,
	fields: InputField[]
): Promise<OutputField[]> {
	if (!process.env.GEMINI_API_KEY) {
		throw new Error("Missing GEMINI_API_KEY");
	}

	if (!fields.length) {
		return [];
	}

	const modelsToTry = [
		"gemini-2.5-flash",
		"gemini-2.0-flash",
	];

	let lastError: unknown;

	for (const model of modelsToTry) {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				return await callGeminiModel(model, collectionName, fields);
			} catch (error: unknown) {
				lastError = error;

				const message =
					error instanceof Error ? error.message : String(error);

				const isRetryable =
					message.includes('"code":503') ||
					message.includes('"status":"UNAVAILABLE"') ||
					message.includes("high demand") ||
					message.includes("UNAVAILABLE");

				if (!isRetryable) {
					throw error;
				}

				if (attempt < 2) {
					const delay = Math.pow(2, attempt) * 1000;
					await sleep(delay);
				}
			}
		}
	}

	if (lastError instanceof Error) {
		throw new Error(
			`Gemini is temporarily unavailable. Please try again in a moment. Original error: ${lastError.message}`
		);
	}

	throw new Error("Gemini is temporarily unavailable. Please try again in a moment.");
}