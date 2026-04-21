export class CacheService {
	private cache = new Map<string, unknown>();

	get(key: string): unknown {
		return this.cache.get(key);
	}

	set(key: string, value: unknown): void {
		this.cache.set(key, value);
	}

	has(key: string): boolean {
		return this.cache.has(key);
	}

	delete(key: string): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}
}

const cacheService = new CacheService();

export default cacheService;