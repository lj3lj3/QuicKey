import trackers from "@/background/page-trackers";
import { IsEdge, IsFirefox } from "@/background/constants";
import storage from "@/background/quickey-storage";
import { connect } from "@/lib/ipc";


const backgroundTracker = trackers.background;

const BadgeColors = {
	light: {
			// make the count background slightly darker in FF and Edge so the
			// text is rendered in white instead of black on dark grey
		normal: (IsFirefox || IsEdge)
			? "#666"
			: "#777",
		inverted: "#3367d6"
	},
	dark: {
		normal: "#666",
		inverted: "#3367d6"
	}
};
const IconSizes = [16, 19, 24, 32, 38].reduce((result, size) => {
		// with manifest V3, the icon paths are relative to the background JS
		// file, so start with a / to make them absolute to the install folder
	result.normal.path[size] = `/img/icon-${size}.png`;
	result.inverted.path[size] = `/img/icon-${size}-inverted.png`;

	return result;
}, {
	normal: { path: {} },
	inverted: { path: {} }
});
const IconPaths = {
	light: {
		...IconSizes
	},
	dark: {
		normal: IconSizes.inverted,
		inverted: IconSizes.normal
	}
};
const ExtensionName = chrome.runtime.getManifest().short_name;

	// Chrome Tab Group 颜色名称到十六进制的映射，与 popup 中的 group-color-* 样式保持一致
const GroupColors = {
	grey:   "#5f6368",
	blue:   "#1a73e8",
	red:    "#d93025",
	yellow: "#f9ab00",
	green:  "#1e8e3e",
	pink:   "#d01884",
	purple: "#a142f4",
	cyan:   "#007b83",
	orange: "#e8710a"
};


let isNormalIcon = true;
let isTabCountVisible = false;
let tabCount = 0;
let inversionTimer;
let colorScheme = "light";
let badgeMode = "none";
let currentGroupId = -1;


function getIconsAndBadgeColor(
	inverted)
{
	const iconMode = inverted ? "inverted" : "normal";
	const paths = IconPaths[colorScheme][iconMode];
	const color = BadgeColors[colorScheme][iconMode];

	return { paths, color };
}


async function setNormalIcon()
{
	const {paths, color} = getIconsAndBadgeColor();

		// in case we were called directly and not by the inversion timer, we
		// want to clear any existing timer
	clearTimeout(inversionTimer);
	isNormalIcon = true;

	try {
		await chrome.action.setBadgeBackgroundColor({ color });
		await chrome.action.setIcon(paths);
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


async function setColorScheme(
	name)
{
	colorScheme = name;
	await setNormalIcon();
}


async function invertFor(
	ms = 750)
{
		// pass true to get the inverted colors
	const {paths, color} = getIconsAndBadgeColor(true);

	clearTimeout(inversionTimer);
	inversionTimer = setTimeout(setNormalIcon, ms);
	isNormalIcon = false;

	try {
		if (isTabCountVisible) {
			await chrome.action.setBadgeBackgroundColor({ color });
		} else {
			await chrome.action.setIcon(paths);
		}
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


	// 根据当前激活标签更新 group badge（显示文件夹名称和颜色）
async function updateGroupBadge(
	tab)
{
	const groupId = tab?.groupId ?? -1;
	currentGroupId = groupId;

	if (groupId <= 0) {
		try {
			await chrome.action.setBadgeText({ text: "" });
		} catch (error) {
			backgroundTracker.exception(error);
		}
		return;
	}

	try {
		const group = await chrome.tabGroups.get(groupId);
		const title = (group.title || "").slice(0, 4).trim();
		const color = GroupColors[group.color] || GroupColors.grey;

		await chrome.action.setBadgeText({ text: title });
		await chrome.action.setBadgeBackgroundColor({ color });
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


	// 设置 badge 显示模式：none（不显示）/ count（标签数量）/ group（文件夹名称）
async function setBadgeMode(
	mode,
	tab)
{
	badgeMode = mode;

	if (mode === "count") {
		isTabCountVisible = true;
		tabCount = (await chrome.tabs.query({})).length;
		await setNormalIcon();
		await updateTabCount();
	} else if (mode === "group") {
		isTabCountVisible = false;
		await setNormalIcon();
		await updateGroupBadge(tab);
	} else {
		isTabCountVisible = false;
		await setNormalIcon();

		try {
			await chrome.action.setBadgeText({ text: "" });
		} catch (error) {
			backgroundTracker.exception(error);
		}
	}
}


async function updateTabCount(
	delta = 0)
{
		// default to an empty string, which will hide the badge
	let text = "";
	let title = ExtensionName;

	tabCount += delta;


	if (isTabCountVisible) {
		text = String(tabCount);

			// Edge appends the badge count with a comma after the badge title,
			// which looks awkward: "829 open tabs, 829".  so don't customize
			// the title in Edge.  format the count with a comma if the user
			// has 1,000+ (!) tabs open.
		if (!IsEdge) {
			title = `${ExtensionName} - ${tabCount.toLocaleString()} open tab${tabCount == 1 ? "" : "s"}`;
		}
	}

	try {
		await chrome.action.setBadgeText({ text }),
		await chrome.action.setTitle({ title })
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


connect("colorScheme").receive({
	async setColorScheme(
		name)
	{
		if (name !== colorScheme) {
			await setColorScheme(name);
			await storage.set(() => ({ colorScheme: name }));
		}
	}
});


export default {
	setColorScheme,
	setNormalIcon,
	invertFor,
	setBadgeMode,
	updateGroupBadge,
	updateTabCount,
	get isNormal() {
		return isNormalIcon;
	},
	get badgeMode() {
		return badgeMode;
	},
	get currentGroupId() {
		return currentGroupId;
	}
};
