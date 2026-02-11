import React, { useState, useEffect } from "react";
import adaptiveHistory from "@/background/adaptive-history";
import historyDB from "@/background/history-db";
import * as k from "@/background/constants";
import {Checkbox} from "./controls";
import NewSetting from "./new-setting";


export default function EnhancedSearchSection({ settings, onChange }) {
	const [adaptiveStats, setAdaptiveStats] = useState(null);
	const [clearingAdaptive, setClearingAdaptive] = useState(false);
	const enabled = settings[k.EnableEnhancedSearch.Key];

	useEffect(() => {
		if (enabled) {
			refreshAdaptiveStats();
		}
	}, [enabled]);

	function refreshAdaptiveStats() {
		historyDB.getDB()
			.then(db => adaptiveHistory.init(db))
			.then(() => setAdaptiveStats(adaptiveHistory.getStats()));
	}

	function handleToggle(value, key) {
		onChange(value, key);
	}

	function handleClearClick() {
		if (clearingAdaptive) {
			adaptiveHistory.clear()
				.then(() => {
					setClearingAdaptive(false);
					refreshAdaptiveStats();
				});
		} else {
			setClearingAdaptive(true);
			setTimeout(() => setClearingAdaptive(false), 5000);
		}
	}

	return (
		<>
			<h2>Enhanced search</h2>

			<NewSetting addedVersion={16}>
				<Checkbox
					id={k.EnableEnhancedSearch.Key}
					label="Enable enhanced search"
					value={enabled}
					onChange={handleToggle}
				>
				<div className="subtitle">
						QuicKey learns from your search selections to provide
						better results over time. For history searches, frequently
						visited pages are also ranked higher. Note: this feature
						is not active in the popup window (Ctrl+Tab) mode for
						faster loading performance.
					</div>
				</Checkbox>
			</NewSetting>

			{enabled && (
				<div className="enhanced-search-controls">
					<div className="search-scope-selector">
						<label htmlFor="defaultSearchScope">Default search scope:</label>
						<select
							id="defaultSearchScope"
							value={settings[k.DefaultSearchScope.Key] || k.DefaultSearchScope.Tabs}
							onChange={(e) => onChange(e.target.value, k.DefaultSearchScope.Key)}
						>
							<option value={k.DefaultSearchScope.Tabs}>
								Tabs only (default)
							</option>
							<option value={k.DefaultSearchScope.TabsHistory}>
								Tabs + History
							</option>
							<option value={k.DefaultSearchScope.TabsBookmarks}>
								Tabs + Bookmarks
							</option>
							<option value={k.DefaultSearchScope.All}>
								Tabs + History + Bookmarks
							</option>
						</select>
						<div className="subtitle">
							Choose which data sources to include when searching
							without a /h or /b prefix.
						</div>
					</div>

					<div className="adaptive-stats">
						<span className="label">Learned selections: </span>
						<span className="value">
							{adaptiveStats
								? adaptiveStats.totalEntries.toLocaleString()
								: "..."}
						</span>
						<button
							className="key refresh-btn"
							onClick={refreshAdaptiveStats}
							title="Refresh count"
						>↻</button>
					</div>

					<div className="adaptive-clear">
						<p className="subtitle">
							Clear all learned search data. This does not affect
							your browsing history or bookmarks.
						</p>
						<button
							className="key"
							onClick={handleClearClick}
						>
							{clearingAdaptive
								? "Click again to confirm"
								: "Clear learned data"}
						</button>
					</div>
				</div>
			)}
		</>
	);
}
