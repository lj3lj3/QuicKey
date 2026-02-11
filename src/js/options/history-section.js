import React, {useContext, useState, useRef} from "react";
import {Checkbox} from "./controls";
import {Section} from "./sections";
import NewSetting from "./new-setting";
import {OptionsContext} from "./options-provider";
import historyDB from "@/background/history-db";
import * as k from "@/background/constants";


export default function HistorySection()
{
	const {
		settings,
		onChange
	} = useContext(OptionsContext);

	const [stats, setStats] = useState(null);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState(null);
	const [clearing, setClearing] = useState(false);
	const fileInputRef = useRef(null);


	function refreshStats()
	{
		historyDB.getStats()
			.then(setStats);
	}


	function handleToggleChange(
		value,
		key)
	{
		onChange(value, key);

		if (value) {
			setTimeout(refreshStats, 1000);
		}
	}


	function handleImportClick()
	{
		fileInputRef.current?.click();
	}


	function handleFileChange(
		event)
	{
		const file = event.target.files[0];

		if (!file) {
			return;
		}

		setImporting(true);
		setImportResult(null);

		const reader = new FileReader();

		reader.onload = (e) => {
			historyDB.importFromHTU(e.target.result)
				.then(count => {
					setImportResult({
						success: true,
						message: `Successfully imported ${count} unique URLs.`
					});
					refreshStats();
				})
				.catch(error => {
					setImportResult({
						success: false,
						message: `Import failed: ${error.message}`
					});
				})
				.finally(() => {
					setImporting(false);
					event.target.value = "";
				});
		};

		reader.onerror = () => {
			setImportResult({
				success: false,
				message: "Failed to read the file."
			});
			setImporting(false);
		};

		reader.readAsText(file);
	}


	function handleClearClick()
	{
		if (clearing) {
			historyDB.clear()
				.then(() => {
					setClearing(false);
					refreshStats();
				});
		} else {
			setClearing(true);

			setTimeout(() => setClearing(false), 5000);
		}
	}


	if (settings[k.EnableUnlimitedHistory.Key] && !stats) {
		refreshStats();
	}


	return (
		<Section>
			<h2>Unlimited history</h2>

			<NewSetting addedVersion={15}>
				<Checkbox
					id={k.EnableUnlimitedHistory.Key}
					label="Enable unlimited history search"
					value={settings[k.EnableUnlimitedHistory.Key]}
					onChange={handleToggleChange}
				>
					<div className="subtitle">
						When enabled, QuicKey stores your browsing history locally for
						searching beyond Chrome's ~90 day limit. History items
						searched: up to 10,000.
					</div>
				</Checkbox>
			</NewSetting>

			{settings[k.EnableUnlimitedHistory.Key] && <div className="unlimited-history-controls">
				<div className="history-stats">
					<span className="label">History items stored: </span>
					<span className="value">{stats ? stats.totalItems.toLocaleString() : "..."}</span>
					<button
						className="key refresh-btn"
						onClick={refreshStats}
						title="Refresh count"
					>↻</button>
				</div>

				<div className="history-import">
					<h3>Import history</h3>
					<p className="subtitle">
						Import browsing history from a History Trends Unlimited (HTU)
						TSV export file. Duplicate URLs will be merged automatically.
					</p>
					<input
						ref={fileInputRef}
						type="file"
						accept=".tsv,.txt,.csv"
						style={{display: "none"}}
						onChange={handleFileChange}
					/>
					<button
						className="key"
						onClick={handleImportClick}
						disabled={importing}
					>
						{importing ? "Importing..." : "Import HTU file"}
					</button>
					{importResult && <div className={
						"import-result " + (importResult.success ? "success" : "error")
					}>
						{importResult.message}
					</div>}
				</div>

				<div className="history-clear">
					<h3>Clear stored history</h3>
					<p className="subtitle">
						Remove all locally stored history data. This does not affect
						Chrome's built-in browsing history.
					</p>
					<button
						className="key"
						onClick={handleClearClick}
					>
						{clearing ? "Click again to confirm" : "Clear stored history"}
					</button>
				</div>

			<div className="history-storage-info">
					<h3>Data storage location</h3>
					<p className="subtitle">
						History data is stored in IndexedDB within Chrome's profile
						directory. Uninstalling QuicKey will delete this data.
					</p>
					<p className="subtitle">
						Click below to open <code>chrome://version</code> where you can
						find your "Profile Path". The IndexedDB data is stored under:
					</p>
					<p className="subtitle storage-path">
						<code>{"<Profile Path>"}/IndexedDB/chrome-extension_{chrome.runtime.id}_0.indexeddb.leveldb/</code>
					</p>
					<button
						className="key"
						onClick={() => chrome.tabs.create({ url: "chrome://version" })}
					>
						Open chrome://version
					</button>
				</div>
			</div>}
		</Section>
	);
}
