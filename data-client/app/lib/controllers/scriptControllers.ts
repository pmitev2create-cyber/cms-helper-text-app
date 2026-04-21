import { WebflowClient } from "webflow-api";
import cacheService, { CacheService } from "@/app/lib/services/CacheService";
import { WebflowRateLimiter } from "../services/WebflowRateLimiter";
import crypto from "crypto";
import {
	CustomCodeHostedRequest,
	CustomCodeInlineRequest,
} from "webflow-api/api/resources/scripts";

interface WebflowError {
	statusCode?: number;
	message?: string;
}

function isWebflowError(error: unknown): error is WebflowError {
	return typeof error === "object" && error !== null && "statusCode" in error;
}

type ScriptLocation = "header" | "footer";

type AppliedScript = {
	id: string;
	location: ScriptLocation;
	version: string;
};

type SiteCustomCodeResponse = {
	scripts?: AppliedScript[];
};

export class ScriptController {
	private webflow: WebflowClient;
	private cache: CacheService;
	private rateLimiter: WebflowRateLimiter;

	constructor(webflow: WebflowClient) {
		this.webflow = webflow;
		this.cache = cacheService;
		this.rateLimiter = WebflowRateLimiter.getInstance();
	}

	public updateWebflowClient(webflow: WebflowClient) {
		this.webflow = webflow;
	}

	async getRegisteredScripts(siteId: string) {
		try {
			const data = await this.webflow.scripts.list(siteId);
			return data.registeredScripts;
		} catch (error) {
			console.error("Error fetching scripts:", error);
			throw error;
		}
	}

	async registerInlineScript(siteId: string, request: CustomCodeInlineRequest) {
		try {
			const scriptData = {
				sourceCode: request.sourceCode,
				canCopy: request.canCopy ?? true,
				version: request.version,
				displayName: request.displayName,
			};

			return await this.webflow.scripts.registerInline(siteId, scriptData);
		} catch (error) {
			console.error("Error registering inline script:", error);
			throw error;
		}
	}

	async registerHostedScript(siteId: string, request: CustomCodeHostedRequest) {
		try {
			if (!request.hostedLocation) {
				throw new Error("Hosted location is required");
			}

			const integrityHash = await this.generateSRI(request.hostedLocation);

			const scriptData = {
				hostedLocation: request.hostedLocation,
				integrityHash,
				canCopy: request.canCopy ?? true,
				version: request.version,
				displayName: request.displayName,
			};

			return await this.webflow.scripts.registerHosted(siteId, scriptData);
		} catch (error) {
			console.error("Error registering hosted script:", error);
			throw error;
		}
	}

	async getSiteCustomCode(siteId: string): Promise<SiteCustomCodeResponse> {
		const cacheKey = `site_${siteId}`;
		const cached = this.cache.get(cacheKey) as SiteCustomCodeResponse | undefined;

		if (cached) {
			return cached;
		}

		try {
			const result = (await this.webflow.sites.scripts.getCustomCode(
				siteId
			)) as SiteCustomCodeResponse;

			this.cache.set(cacheKey, result);
			return result;
		} catch (error) {
			console.error("Error fetching site custom code:", error);
			throw error;
		}
	}

	async upsertSiteCustomCode(
		siteId: string,
		scriptId: string,
		location: ScriptLocation,
		version: string
	) {
		try {
			let existingScripts = await this.getExistingScripts("site", siteId);

			existingScripts = existingScripts.filter(
				(script) => script.id !== scriptId
			);

			const nextScript: AppliedScript = {
				id: scriptId,
				location,
				version,
			};

			existingScripts.push(nextScript);

			return await this.webflow.sites.scripts.upsertCustomCode(siteId, {
				scripts: existingScripts,
			});
		} catch (error) {
			console.error("Error upserting site custom code:", error);
			throw error;
		}
	}

	async deleteSiteCustomCode(siteId: string) {
		try {
			const result = await this.webflow.sites.scripts.deleteCustomCode(siteId);
			this.cache.set(`site_${siteId}`, null);
			return result;
		} catch (error) {
			console.error("Error deleting site custom code:", error);
			throw error;
		}
	}

	async getPageCustomCode(pageId: string): Promise<AppliedScript[]> {
		const cacheKey = `page_${pageId}`;
		const cached = this.cache.get(cacheKey) as AppliedScript[] | undefined;

		if (cached) {
			return cached;
		}

		try {
			const response = await this.webflow.pages.scripts.getCustomCode(pageId);
			const result = (response.scripts || []) as AppliedScript[];

			this.cache.set(cacheKey, result);
			return result;
		} catch (error: unknown) {
			if (isWebflowError(error) && error.statusCode !== 404) {
				throw error;
			}

			return [];
		}
	}

	async getMultiplePageCustomCode(
		pageIds: string[]
	): Promise<Map<string, AppliedScript[]>> {
		const results = new Map<string, AppliedScript[]>();
		const uncachedPageIds: string[] = [];

		for (const pageId of pageIds) {
			const cacheKey = `page_${pageId}`;
			const cached = this.cache.get(cacheKey) as AppliedScript[] | undefined;

			if (cached) {
				results.set(pageId, cached);
			} else {
				uncachedPageIds.push(pageId);
			}
		}

		if (uncachedPageIds.length > 0) {
			const batchResults = await this.rateLimiter.processBatch(
				uncachedPageIds,
				async (pageId): Promise<AppliedScript[]> => {
					try {
						const response = await this.webflow.pages.scripts.getCustomCode(pageId);
						const pageScripts = (response.scripts || []) as AppliedScript[];

						this.cache.set(`page_${pageId}`, pageScripts);
						return pageScripts;
					} catch (error: unknown) {
						if (isWebflowError(error) && error.statusCode !== 404) {
							throw error;
						}

						return [];
					}
				}
			);

			for (const [pageId, scripts] of batchResults) {
				results.set(pageId, scripts);
			}
		}

		return results;
	}

	async upsertPageCustomCode(
		pageId: string,
		scriptId: string,
		location: ScriptLocation,
		version: string
	) {
		try {
			let existingScripts = await this.getExistingScripts("page", pageId);

			existingScripts = existingScripts.filter(
				(script) => script.id !== scriptId
			);

			const nextScript: AppliedScript = {
				id: scriptId,
				location,
				version,
			};

			existingScripts.push(nextScript);

			return await this.webflow.pages.scripts.upsertCustomCode(pageId, {
				scripts: existingScripts,
			});
		} catch (error) {
			console.error("Error upserting page custom code:", error);
			throw error;
		}
	}

	async deletePageCustomCode(pageId: string) {
		try {
			const result = await this.webflow.pages.scripts.deleteCustomCode(pageId);
			this.cache.set(`page_${pageId}`, null);
			return result;
		} catch (error) {
			console.error("Error deleting page custom code:", error);
			throw error;
		}
	}

	private async generateSRI(url: string): Promise<string> {
		const response = await fetch(url);
		const data = await response.text();
		const hash = crypto.createHash("sha384").update(data).digest("base64");
		return `sha384-${hash}`;
	}

	private async getExistingScripts(
		type: "site" | "page",
		id: string
	): Promise<AppliedScript[]> {
		try {
			if (type === "site") {
				const response = await this.getSiteCustomCode(id);

				console.log(
					`[DEBUG] getExistingScripts raw response for ${type}:`,
					response
				);

				const scripts = response.scripts || [];

				console.log(
					`[DEBUG] getExistingScripts processed scripts for ${type}:`,
					scripts
				);

				return scripts;
			}

			const response = await this.getPageCustomCode(id);

			console.log(
				`[DEBUG] getExistingScripts raw response for ${type}:`,
				response
			);

			const scripts = response || [];

			console.log(
				`[DEBUG] getExistingScripts processed scripts for ${type}:`,
				scripts
			);

			return scripts;
		} catch (error: unknown) {
			console.error(`[DEBUG] getExistingScripts error for ${type}:`, error);

			if (isWebflowError(error) && error.statusCode !== 404) {
				throw error;
			}

			return [];
		}
	}
}