import Input from "./input";
import {SearchIcon, LoadingIcon} from "@/common/icons";
import handleRef from "@/lib/handle-ref";
import React from "react";
import {IsFirefox} from "@/background/constants";


function ModeBadge({
	mode,
	modeLabels})
{
	const label = modeLabels && modeLabels[mode];

	if (!label) return null;

	return <div className="mode-badge" title={`Mode: ${label.text}`}>
		{label.short}
	</div>
}


function Placeholder({
	mode,
	shortcut,
	text})
{
	const id = mode + "-placeholder";

	return <div id={id} className="command-placeholder">
		{shortcut && <b>{shortcut} </b>}{text}
	</div>
}


export default class SearchBox extends React.Component {
    searchBox = null;


    componentDidMount()
	{
		var queryLength = this.props.pureQuery.length;

			// even if there's a default value, the insertion point gets set
			// to the beginning of the input field, instead of at the end.
			// so move it there after the field is created.
		this.searchBox.setSelectionRange(queryLength, queryLength);
	}


	focus()
	{
		this.searchBox.focus();
	}


	getSelection()
	{
		const {selectionStart, selectionEnd, value} = this.searchBox.input;

		return value.substring(selectionStart, selectionEnd);
	}


	handleRef = handleRef("searchBox", this);


    handleCancelButtonClick = () =>
	{
			// unlike the cancel button in Chrome, clicking the one in FF
			// steals the focus, so set it back in the input
		this.focus();
		this.props.onChange({ target: { value: "" } });
	};


	handleChange = (event) =>
	{
		const {mode, previousMode, modePrefixMap, onChange} = this.props;
		const displayText = event.target.value;
		const prefix = (modePrefixMap && modePrefixMap[mode]) || "";

			// if the user is typing a mode-switch command (e.g. "/", "/h",
			// "/b", "/t"), pass it through directly without re-adding the
			// current mode prefix, so setSearchBoxText() can correctly
			// detect command mode and later switch to the target mode on Tab
		const isCommandInput = /^\/[bht]?$/i.test(displayText);

		if (isCommandInput) {
			onChange({ target: { value: displayText } });
		} else if (mode === "command") {
				// user typed something in command mode that doesn't match
				// a command pattern (e.g. "/h " with a space, or "/hx").
				// cancel command mode: restore the previous mode prefix
				// and use the full typed text as the search query
			const previousPrefix = (modePrefixMap && modePrefixMap[previousMode]) || "";

			onChange({ target: { value: previousPrefix + displayText } });
		} else {
				// re-add the prefix that was stripped from the display, so that
				// setSearchBoxText() receives the full prefixed text and can
				// correctly determine the mode
			onChange({ target: { value: prefix + displayText } });
		}
	};


    render()
	{
		const {
			query,
			pureQuery,
			mode,
			modeLabels,
			forceUpdate,
			selectAll,
			searching,
			onKeyDown,
			onKeyUp
		} = this.props;
		const displayValue = (mode === "command") ? query : pureQuery;

			// we want to show the placeholders only when the user's entered
			// the history or bookmarks mode and the pureQuery is empty.
			// we need to use an Input component that ignores the value prop
			// when it's focused, so that the insertion point position isn't
			// lost if the user moves it from the end and starts typing.
			// that change is forced when the app gets an esc and clears
			// the text.
		const badgeMode = (mode === "command") ? this.props.previousMode : mode;
			// only show the default input placeholder in the default tabs
			// mode; in other modes the command-placeholder overlay handles it
		const inputPlaceholder = (mode === "tabs")
			? "Search all — Tab to switch mode, / for options"
			: "";

		return <div className="search-box has-badge">
			<ModeBadge mode={badgeMode} modeLabels={modeLabels} />
			{searching ? <LoadingIcon /> : <SearchIcon />}
			<Input type="search"
				ref={this.handleRef}
				tabIndex="0"
				placeholder={inputPlaceholder}
				spellCheck={false}
				autoFocus={true}
				value={displayValue}
				forceUpdate={forceUpdate}
				selectAll={selectAll}
				onChange={this.handleChange}
				onKeyDown={onKeyDown}
				onKeyUp={onKeyUp}
			/>
			{mode == "bookmarks" && pureQuery.length == 0 &&
				<Placeholder mode={mode} text="Search for a bookmark title or URL" />}
			{mode == "history" && pureQuery.length == 0 &&
				<Placeholder mode={mode} text="Search for a title or URL from the browser history" />}
			{mode == "openTabs" && pureQuery.length == 0 &&
				<Placeholder mode={mode} text="Search only open tabs" />}
		{mode == "command" &&
			<Placeholder mode={mode} shortcut="/b" text="b=bookmarks, h=history, t=tabs, then Tab" />}
			{(IsFirefox && (pureQuery.length > 0 || mode !== "tabs")) &&
				<div
					className="cancel-button"
					title="Clear search"
					onClick={this.handleCancelButtonClick}
				/>
			}
		</div>
	}
}
