import quickScore from "./quick-score";
import simpleScore from "./simple-score";
import arrayScore from "./array-score";


const HighPriorityWeight = 5;
const GroupTitleKey = {
	key: "groupTitle",
	score: quickScore,
	weight: 1
};

	// use title and displayURL as the two keys to score by default
const DefaultKeys = [
	{
		key: "title",
		score: quickScore
	},
	{
		key: "displayURL",
		score: quickScore
	},
	GroupTitleKey
];
const PinyinKeys = DefaultKeys.concat([
	{
		key: "pinyinTitle",
		score: quickScore
	},
	{
		key: "pinyinDisplayURL",
		score: DefaultKeys[1].score
	}
]);

let QuickScoreArray = arrayScore(quickScore, DefaultKeys);
let PinyinQuickScoreArray = arrayScore(quickScore, PinyinKeys);
let SimpleScoreArray = arrayScore(simpleScore, DefaultKeys.map(({key}) => key));
const MaxAverageLength = 14;
const MaxQueryLength = 2 * MaxAverageLength;


function totalLength(
	strings)
{
	return strings.reduce((result, string) => result + string.length, 0);
}


export function setGroupTitlePriority(
	isHighest)
{
	GroupTitleKey.weight = isHighest ? HighPriorityWeight : 1;
	QuickScoreArray = arrayScore(quickScore, DefaultKeys);
	PinyinQuickScoreArray = arrayScore(quickScore, PinyinKeys);
	SimpleScoreArray = arrayScore(simpleScore, DefaultKeys.map(({key}) => key));
}


export default function scoreItems(
	items,
	tokens,
	usePinyin)
{
	const queryLength = totalLength(tokens);
	const averageLength = queryLength / tokens.length;

	if (queryLength <= MaxQueryLength && averageLength <= MaxAverageLength) {
		if (usePinyin) {
			return PinyinQuickScoreArray(items, tokens);
		} else {
			return QuickScoreArray(items, tokens);
		}
	} else {
		return SimpleScoreArray(items, tokens);
	}
}


export async function scoreItemsAsync(
	items,
	tokens,
	usePinyin)
{
	const queryLength = totalLength(tokens);
	const averageLength = queryLength / tokens.length;

	if (queryLength <= MaxQueryLength && averageLength <= MaxAverageLength) {
		if (usePinyin) {
			return PinyinQuickScoreArray.async(items, tokens);
		} else {
			return QuickScoreArray.async(items, tokens);
		}
	} else {
		return SimpleScoreArray.async(items, tokens);
	}
}
