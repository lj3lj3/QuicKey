/**
 * Independent data store for each search mode.
 * Each mode (tabs, bookmarks, history, openTabs, command) maintains its own
 * store instance, preventing data leakage across mode switches.
 */
export default class ModeDataStore {
	constructor(mode)
	{
		this.mode = mode;
		this.items = [];
		this.promise = null;
		this.maxItems = 0;
	}

	get length()
	{
		return this.items.length;
	}

	clear()
	{
		this.items = [];
		this.promise = null;
		this.maxItems = 0;
	}

	isLoadedWith(maxItems)
	{
		return this.items.length > 0 && this.maxItems === maxItems;
	}
}
