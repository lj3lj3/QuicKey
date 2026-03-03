const CharPattern = /./g;
	// use a NUL character to replace the matches so nothing in subsequent query
	// tokens will match an existing match
const ReplacementChar = "\x00";


const numerically = (a, b) => a - b;


function replaceMatches(
	string,
	matches)
{
	const start = matches[0];
	const end = matches[matches.length - 1];
	const replacementSection = string.slice(start, end + 1);
	const indexes = [...matches];
	let nextIndex = indexes.shift();

	return string.slice(0, start) +
		replacementSection.replace(CharPattern, (char, i) => {
			if (start + i === nextIndex) {
				nextIndex = indexes.shift();

				return ReplacementChar;
			} else {
				return char;
			}
		}) +
		string.slice(end + 1);
}


function sumScores(
	tokenScores)
{
	let total = 0;

	for (const score of tokenScores) {
		if (!score) {
			return 0;
		}

		total += score;
	}

	return total;
}



export default function(
	score,
	searchKeyInfo)
{
		// force keyNames to be an array
	const keys = [].concat(searchKeyInfo || "string").map(key =>
		typeof key != "object"
			? { key, score }
			: key
	);
	const defaultKeyName = keys[0].key;


	function compareScoredStrings(
		a,
		b)
	{
		if (a.score === b.score) {
			if (a.lastVisit && b.lastVisit) {
				return b.lastVisit - a.lastVisit;
			} else {
				return a[defaultKeyName].toLocaleLowerCase() < b[defaultKeyName].toLocaleLowerCase() ? -1 : 1;
			}
		} else {
			return b.score - a.score;
		}
	}


	function initItem(
		item)
	{
		if (!item.scores) {
			item.score = 0;
			item.scores = {};
			item.hitMasks = {};

			keys.forEach(({key}) => {
				item.scores[key] = 0;
				item.hitMasks[key] = [];
			});
		}
	}


	function initItems(
		items)
	{
		for (let i = 0, len = items.length; i < len; i++) {
			initItem(items[i]);
		}
	}


	function scoreSingleToken(
		items,
		query)
	{
		for (const item of items) {
				// find the highest score for each keyed string on this item
			item.score = keys.reduce((currentScore, {key, score, weight}) => {
				const hitMask = [];
				const string = item[key];
					// score empty strings as 0
				const newScore = string
					? score(string, query, hitMask) * (weight || 1) * (item.recentBoost || 1)
					: 0;

				item.scores[key] = newScore;
				item.hitMasks[key] = hitMask;

				return Math.max(currentScore, newScore);
			}, 0);
		}
	}


	function scoreMultipleTokens(
		items,
		tokens,
		startIndex,
		endIndex)
	{
		for (let idx = startIndex; idx < endIndex; idx++) {
			const item = items[idx];
			const tokenScores = new Array(tokens.length).fill(0);

			for (const { key, score, weight } of keys) {
				const hitMask = [];
				let string = item[key];
				let keyScore = 0;
				const keyWeight = weight || 1;

					// empty strings will get a score of 0
				if (string) {
					for (let i = 0, len = tokens.length; i < len; i++) {
						const token = tokens[i];
						const tokenMatches = [];
						const tokenScore = score(string, token, tokenMatches) * keyWeight;

						if (tokenScore) {
							string = replaceMatches(string, tokenMatches);
							hitMask.push(...tokenMatches);
							keyScore += tokenScore;
							tokenScores[i] = Math.max(tokenScore, tokenScores[i]);
						}
					}

					if (keyScore) {
						hitMask.sort(numerically);
					}
				}

				item.scores[key] = keyScore;
				item.hitMasks[key] = hitMask;
			}

				// set the score to 0 if every token doesn't match at least
				// one of the keys
			item.score = sumScores(tokenScores) * (item.recentBoost ?? 1);
		}
	}


	function scoreArraySync(
		items,
		tokens)
	{
		initItems(items);

		if (tokens.length === 1) {
			scoreSingleToken(items, tokens[0]);
		} else if (tokens.length > 1) {
			scoreMultipleTokens(items, tokens, 0, items.length);
		}

		items.sort(compareScoredStrings);

		return items;
	}


	scoreArraySync.async = async function scoreArrayAsync(
		items,
		tokens,
		chunkSize = 2000,
		signal = null)
	{
		initItems(items);

		// early termination config
		const TopKSize = 50;
		const MaxLowChunks = 3;
		const MinChunksBeforeTermination = 3;

		const topKScores = [];
		let consecutiveLowChunks = 0;
		let chunksProcessed = 0;

		function updateTopK(chunkStart, chunkEnd) {
			for (let i = chunkStart; i < chunkEnd; i++) {
				const s = items[i].score;

				if (topKScores.length < TopKSize) {
					topKScores.push(s);

					if (topKScores.length === TopKSize) {
						topKScores.sort((a, b) => a - b);
					}
				} else if (s > topKScores[0]) {
					topKScores[0] = s;
					topKScores.sort((a, b) => a - b);
				}
			}
		}

		function shouldTerminate(chunkStart, chunkEnd) {
			chunksProcessed++;

			if (chunksProcessed <= MinChunksBeforeTermination
				|| topKScores.length < TopKSize) {
				return false;
			}

			const threshold = topKScores[0];

			if (threshold <= 0) {
				return false;
			}

			// check if any item in this chunk exceeded the top-K minimum
			let chunkMax = 0;

			for (let i = chunkStart; i < chunkEnd; i++) {
				if (items[i].score > chunkMax) {
					chunkMax = items[i].score;
				}
			}

			if (chunkMax < threshold * 0.5) {
				consecutiveLowChunks++;
			} else {
				consecutiveLowChunks = 0;
			}

			return consecutiveLowChunks >= MaxLowChunks;
		}

		if (tokens.length === 1) {
				// single token scoring is relatively fast, process in chunks
			const query = tokens[0];

			for (let i = 0; i < items.length; i += chunkSize) {
				const end = Math.min(i + chunkSize, items.length);

				for (let j = i; j < end; j++) {
					const item = items[j];

					item.score = keys.reduce((currentScore, {key, score, weight}) => {
						const hitMask = [];
						const string = item[key];
						const newScore = string
							? score(string, query, hitMask) * (weight || 1) * (item.recentBoost || 1)
							: 0;

						item.scores[key] = newScore;
						item.hitMasks[key] = hitMask;

						return Math.max(currentScore, newScore);
					}, 0);
				}

				updateTopK(i, end);

				if (shouldTerminate(i, end)) {
					// trim unscored items (they remain with score 0)
					break;
				}

				if (end < items.length) {
					await yieldToMain();

					if (signal && signal.aborted) {
						return items;
					}
				}
			}
		} else if (tokens.length > 1) {
			for (let i = 0; i < items.length; i += chunkSize) {
				const end = Math.min(i + chunkSize, items.length);

				scoreMultipleTokens(items, tokens, i, end);

				updateTopK(i, end);

				if (shouldTerminate(i, end)) {
					break;
				}

				if (end < items.length) {
					await yieldToMain();

					if (signal && signal.aborted) {
						return items;
					}
				}
			}
		}

		items.sort(compareScoredStrings);

		return items;
	};


	return scoreArraySync;
}


function yieldToMain()
{
	return new Promise(resolve => {
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(() => setTimeout(resolve, 0));
		} else {
			setTimeout(resolve, 0);
		}
	});
}
