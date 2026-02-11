/**
 * Calculate a Frecency boost factor based on visit frequency and recency.
 * Used by both history mode and hybrid search mode.
 *
 * @param {Object} item - must have visitCount and lastVisitTime properties
 * @returns {number} boost factor (range: ~0.1 to ~1.1)
 */
export function calculateFrecencyBoost(item) {
	const ageInDays = (Date.now() - item.lastVisitTime) / (24 * 60 * 60 * 1000);

	let timeWeight;
	if (ageInDays <= 4) timeWeight = 1.0;
	else if (ageInDays <= 14) timeWeight = 0.7;
	else if (ageInDays <= 31) timeWeight = 0.5;
	else if (ageInDays <= 90) timeWeight = 0.3;
	else timeWeight = 0.1;

	const frequencyFactor = 1 + Math.log10(Math.max(item.visitCount, 1)) * 0.1;

	return timeWeight * frequencyFactor;
}
