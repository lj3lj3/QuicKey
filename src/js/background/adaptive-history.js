const STORE_NAME = "inputHistory";
const MAX_ENTRIES = 5000;
const CLEANUP_THRESHOLD = 6000;
const ENTRY_MAX_AGE_DAYS = 90;
const BOOST_SCALE = 0.15;

const MAX_BOOST_BY_MODE = {
	tabs: 0.25,
	history: 0.5,
	bookmarks: 0.5
};

let cache = new Map();
let cacheLoaded = false;
let dbRef = null;


function normalizeInput(input) {
	return input.trim().toLowerCase().replace(/\s+/g, " ");
}


function makeId(mode, input, url) {
	return mode + "|" + input + "|" + url;
}


function makeCacheKey(mode, input) {
	return mode + "|" + input;
}


function calculateBoost(useCount, lastUsed, mode) {
	const ageInDays = (Date.now() - lastUsed) / (24 * 60 * 60 * 1000);
	const maxBoost = MAX_BOOST_BY_MODE[mode] || 0.5;

	// time decay factor
	let timeFactor;
	if (ageInDays <= 1) timeFactor = 1.0;
	else if (ageInDays <= 7) timeFactor = 0.8;
	else if (ageInDays <= 30) timeFactor = 0.5;
	else if (ageInDays <= 60) timeFactor = 0.3;
	else timeFactor = 0.1;

	// logarithmic frequency scaling
	const frequencyFactor = Math.log2(useCount + 1);

	return Math.min(maxBoost, BOOST_SCALE * frequencyFactor * timeFactor);
}


function cleanupOldEntries() {
	if (!dbRef) return;

	const cutoff = Date.now() - (ENTRY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
	const tx = dbRef.transaction(STORE_NAME, "readwrite");
	const store = tx.objectStore(STORE_NAME);
	const index = store.index("byLastUsed");
	const range = IDBKeyRange.upperBound(cutoff);
	const request = index.openCursor(range);

	request.onsuccess = (event) => {
		const cursor = event.target.result;

		if (cursor) {
			const { mode, input, url } = cursor.value;
			const cacheKey = makeCacheKey(mode, input);

			cursor.delete();

			const inputMap = cache.get(cacheKey);
			if (inputMap) {
				inputMap.delete(url);
				if (inputMap.size === 0) {
					cache.delete(cacheKey);
				}
			}

			cursor.continue();
		}
	};
}


const adaptiveHistory = {
	/**
	 * Load all records from IndexedDB into memory cache.
	 * @param {IDBDatabase} database
	 */
	init(database) {
		dbRef = database;
		cache = new Map();
		cacheLoaded = false;

		return new Promise((resolve, reject) => {
			const tx = database.transaction(STORE_NAME, "readonly");
			const store = tx.objectStore(STORE_NAME);
			const request = store.getAll();

			request.onsuccess = () => {
				const records = request.result || [];

				for (const record of records) {
					const cacheKey = makeCacheKey(record.mode, record.input);
					let inputMap = cache.get(cacheKey);

					if (!inputMap) {
						inputMap = new Map();
						cache.set(cacheKey, inputMap);
					}

					inputMap.set(record.url, {
						useCount: record.useCount,
						lastUsed: record.lastUsed
					});
				}

				cacheLoaded = true;
				resolve();
			};

			request.onerror = () => {
				console.error("[adaptive-history] Failed to load:", request.error);
				reject(request.error);
			};
		});
	},


	/**
	 * Whether the cache has been loaded from IndexedDB.
	 */
	isLoaded() {
		return cacheLoaded;
	},


	/**
	 * Record a user selection.
	 * @param {string} input - raw query string
	 * @param {string} url - selected URL
	 * @param {string} mode - "tabs" | "history" | "bookmarks"
	 */
	record(input, url, mode) {
		const normalized = normalizeInput(input);
		if (!normalized || !url || !mode) return;

		const cacheKey = makeCacheKey(mode, normalized);
		const now = Date.now();

		// update in-memory cache
		let inputMap = cache.get(cacheKey);
		if (!inputMap) {
			inputMap = new Map();
			cache.set(cacheKey, inputMap);
		}

		const existing = inputMap.get(url);
		if (existing) {
			existing.useCount++;
			existing.lastUsed = now;
		} else {
			inputMap.set(url, { useCount: 1, lastUsed: now });
		}

		// persist to IndexedDB
		if (!dbRef) return;

		const id = makeId(mode, normalized, url);
		const tx = dbRef.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		const getRequest = store.get(id);

		getRequest.onsuccess = () => {
			const record = getRequest.result;

			if (record) {
				record.useCount++;
				record.lastUsed = now;
				store.put(record);
			} else {
				store.put({
					id,
					input: normalized,
					url,
					mode,
					useCount: 1,
					lastUsed: now
				});
			}
		};

		// trigger cleanup if cache is too large
		let totalEntries = 0;
		for (const map of cache.values()) {
			totalEntries += map.size;
		}
		if (totalEntries > CLEANUP_THRESHOLD) {
			cleanupOldEntries();
		}
	},


	/**
	 * Get adaptive boost multipliers for a given query and mode.
	 * Returns synchronously from the in-memory cache.
	 * @param {string} input - raw query string
	 * @param {string} mode - "tabs" | "history" | "bookmarks"
	 * @returns {Object<string, number>} - map of url → boost multiplier
	 */
	getBoosts(input, mode) {
		if (!cacheLoaded) return {};

		const normalized = normalizeInput(input);
		const cacheKey = makeCacheKey(mode, normalized);
		const inputMap = cache.get(cacheKey);

		if (!inputMap) return {};

		const boosts = {};

		for (const [url, data] of inputMap) {
			const boost = calculateBoost(data.useCount, data.lastUsed, mode);

			if (boost > 0.01) {
				boosts[url] = 1 + boost;
			}
		}

		return boosts;
	},


	/**
	 * Remove all entries for a specific URL (when user deletes history/bookmark).
	 * @param {string} url
	 */
	removeURL(url) {
		for (const [cacheKey, inputMap] of cache) {
			if (inputMap.has(url)) {
				inputMap.delete(url);
				if (inputMap.size === 0) {
					cache.delete(cacheKey);
				}
			}
		}

		if (!dbRef) return;

		const tx = dbRef.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		const request = store.openCursor();

		request.onsuccess = (event) => {
			const cursor = event.target.result;
			if (cursor) {
				if (cursor.value.url === url) {
					cursor.delete();
				}
				cursor.continue();
			}
		};
	},


	/**
	 * Clear all adaptive history data.
	 */
	clear() {
		cache = new Map();

		if (!dbRef) return Promise.resolve();

		return new Promise((resolve, reject) => {
			const tx = dbRef.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	},


	/**
	 * Get statistics for the options page.
	 */
	getStats() {
		let totalEntries = 0;
		let modeBreakdown = { tabs: 0, history: 0, bookmarks: 0 };
		const uniqueInputs = cache.size;

		for (const [cacheKey, map] of cache) {
			const mode = cacheKey.split("|")[0];
			const count = map.size;
			totalEntries += count;
			if (modeBreakdown[mode] !== undefined) {
				modeBreakdown[mode] += count;
			}
		}

		return { totalEntries, uniqueInputs, modeBreakdown };
	}
};


export default adaptiveHistory;
