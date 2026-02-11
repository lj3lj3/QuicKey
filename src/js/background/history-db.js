const DB_NAME = "QuicKeyHistory";
const DB_VERSION = 1;
const STORE_NAME = "history";
const META_STORE = "meta";
const META_INITIALIZED = "initialized";
const InitialImportMaxResults = 1000;
const InitialImportLoopCount = 2;


let db = null;


function openDB()
{
	if (db) {
		return Promise.resolve(db);
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const database = event.target.result;

			if (!database.objectStoreNames.contains(STORE_NAME)) {
				const store = database.createObjectStore(STORE_NAME, { keyPath: "url" });

				store.createIndex("byTime", "lastVisitTime", { unique: false });
			}

			if (!database.objectStoreNames.contains(META_STORE)) {
				database.createObjectStore(META_STORE, { keyPath: "name" });
			}
		};

		request.onsuccess = (event) => {
			db = event.target.result;

			db.onclose = () => { db = null; };

			resolve(db);
		};

		request.onerror = (event) => {
			console.error("Failed to open IndexedDB:", event.target.error);
			reject(event.target.error);
		};
	});
}


function getMeta(
	database,
	key)
{
	return new Promise((resolve, reject) => {
		const tx = database.transaction(META_STORE, "readonly");
		const store = tx.objectStore(META_STORE);
		const request = store.get(key);

		request.onsuccess = () => resolve(request.result?.value);
		request.onerror = () => reject(request.error);
	});
}


function setMeta(
	database,
	key,
	value)
{
	return new Promise((resolve, reject) => {
		const tx = database.transaction(META_STORE, "readwrite");
		const store = tx.objectStore(META_STORE);
		const request = store.put({ name: key, value });

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}


function importFromChromeHistory(
	database)
{
	let allItems = [];
	let imported = 0;

	function fetchBatch(
		endTime,
		remaining)
	{
		if (remaining <= 0) {
			return Promise.resolve();
		}

		return chrome.history.search({
			text: "",
			startTime: 0,
			endTime,
			maxResults: InitialImportMaxResults
		})
			.then(items => {
				if (!items.length) {
					return;
				}

				allItems = allItems.concat(items);

				const lastTime = items[items.length - 1].lastVisitTime;

				return fetchBatch(lastTime, remaining - 1);
			});
	}

	return fetchBatch(Date.now(), InitialImportLoopCount)
		.then(() => batchWrite(database, allItems.map(item => ({
			url: item.url,
			title: item.title || "",
			lastVisitTime: item.lastVisitTime,
			visitCount: item.visitCount || 1
		}))))
		.then(count => {
			imported = count;

			return setMeta(database, META_INITIALIZED, true);
		})
		.then(() => {
			DEBUG && console.log(`[history-db] Imported ${imported} items from chrome.history`);

			return imported;
		});
}


function batchWrite(
	database,
	items)
{
	if (!items.length) {
		return Promise.resolve(0);
	}

	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		let count = 0;

		tx.oncomplete = () => resolve(count);
		tx.onerror = () => reject(tx.error);

		items.forEach(item => {
			const getRequest = store.get(item.url);

			getRequest.onsuccess = () => {
				const existing = getRequest.result;

				if (existing) {
					const merged = {
						url: item.url,
						title: item.title || existing.title,
						lastVisitTime: Math.max(
							item.lastVisitTime || 0,
							existing.lastVisitTime || 0
						),
						visitCount: (existing.visitCount || 0) + (item.visitCount || 1)
					};

					store.put(merged);
				} else {
					store.put({
						url: item.url,
						title: item.title || "",
						lastVisitTime: item.lastVisitTime || 0,
						visitCount: item.visitCount || 1
					});
				}

				count++;
			};
		});
	});
}


function parseHTUTimestamp(
	raw)
{
	const str = raw.startsWith("U") ? raw.slice(1) : raw;

	return Math.floor(parseFloat(str));
}


const historyDB = {
	init()
	{
		return openDB()
			.then(database => getMeta(database, META_INITIALIZED))
			.then(initialized => {
				if (!initialized) {
					return openDB().then(importFromChromeHistory);
				}
			})
			.catch(error => {
				console.error("[history-db] Init failed:", error);
			});
	},


	addVisit(
		item)
	{
		return openDB()
			.then(database => {
				return new Promise((resolve, reject) => {
					const tx = database.transaction(STORE_NAME, "readwrite");
					const store = tx.objectStore(STORE_NAME);
					const getRequest = store.get(item.url);

					getRequest.onsuccess = () => {
						const existing = getRequest.result;

						if (existing) {
							store.put({
								url: item.url,
								title: item.title || existing.title,
								lastVisitTime: Math.max(
									item.lastVisitTime || Date.now(),
									existing.lastVisitTime || 0
								),
								visitCount: (existing.visitCount || 0) + 1
							});
						} else {
							store.put({
								url: item.url,
								title: item.title || "",
								lastVisitTime: item.lastVisitTime || Date.now(),
								visitCount: 1
							});
						}

						resolve();
					};

					getRequest.onerror = () => reject(getRequest.error);

					tx.onerror = () => reject(tx.error);
				});
			})
			.catch(error => {
				console.error("[history-db] addVisit failed:", error);
			});
	},


	search(
maxResults = 1000)
	{
		return openDB()
			.then(database => {
				return new Promise((resolve, reject) => {
					const tx = database.transaction(STORE_NAME, "readonly");
					const store = tx.objectStore(STORE_NAME);
					const index = store.index("byTime");
					const results = [];
					const cursorRequest = index.openCursor(null, "prev");

					cursorRequest.onsuccess = (event) => {
						const cursor = event.target.result;

						if (cursor && results.length < maxResults) {
							results.push(cursor.value);
							cursor.continue();
						} else {
							resolve(results);
						}
					};

					cursorRequest.onerror = () => reject(cursorRequest.error);
				});
			})
			.catch(error => {
				console.error("[history-db] search failed:", error);

				return [];
			});
	},


	remove(
		url)
	{
		return openDB()
			.then(database => {
				return new Promise((resolve, reject) => {
					const tx = database.transaction(STORE_NAME, "readwrite");
					const store = tx.objectStore(STORE_NAME);
					const request = store.delete(url);

					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				});
			})
			.catch(error => {
				console.error("[history-db] remove failed:", error);
			});
	},


	clear()
	{
		return openDB()
			.then(database => {
				return new Promise((resolve, reject) => {
					const tx = database.transaction(STORE_NAME, "readwrite");
					const store = tx.objectStore(STORE_NAME);
					const request = store.clear();

					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				});
			})
			.catch(error => {
				console.error("[history-db] clear failed:", error);
			});
	},


	getStats()
	{
		return openDB()
			.then(database => {
				return new Promise((resolve, reject) => {
					const tx = database.transaction(STORE_NAME, "readonly");
					const store = tx.objectStore(STORE_NAME);
					const request = store.count();

					request.onsuccess = () => resolve({ totalItems: request.result });
					request.onerror = () => reject(request.error);
				});
			})
			.catch(error => {
				console.error("[history-db] getStats failed:", error);

				return { totalItems: 0 };
			});
	},


	importFromHTU(
		fileContent)
	{
		const lines = fileContent.split("\n").filter(l => l.trim());
		const aggregated = {};

		for (const line of lines) {
			const parts = line.split("\t");

			if (parts.length < 4) {
				continue;
			}

			const [url, rawTime, , title] = parts;
			const visitTime = parseHTUTimestamp(rawTime);

			if (isNaN(visitTime)) {
				continue;
			}

			if (url in aggregated) {
				const existing = aggregated[url];

				existing.visitCount++;

				if (visitTime > existing.lastVisitTime) {
					existing.lastVisitTime = visitTime;
					existing.title = title || existing.title;
				}
			} else {
				aggregated[url] = {
					url,
					title: title || "",
					lastVisitTime: visitTime,
					visitCount: 1
				};
			}
		}

		const items = Object.values(aggregated);

		return openDB()
			.then(database => batchWrite(database, items))
			.then(count => {
				DEBUG && console.log(`[history-db] Imported ${count} items from HTU TSV`);

				return count;
			})
			.catch(error => {
				console.error("[history-db] HTU import failed:", error);

				throw error;
			});
	},


	close()
	{
		if (db) {
			db.close();
			db = null;
		}
	}
};


export default historyDB;
