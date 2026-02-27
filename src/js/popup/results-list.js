import React from "react";
import {List} from "react-window";
import {IsFirefox, ResultsListRowHeight} from "@/background/constants";


	// in FF, the scrollbar appears inside the right edge of the scrolling
	// area, instead on the outside.  so make the virtual list go right to
	// the edge of the popup, so the scrollbar doesn't cover the content.
const ScrollbarPadding = IsFirefox ? 5 : 10;
const MinShownTime = 200;


function getListWidth()
{
	return document.body.clientWidth - ScrollbarPadding;
}


// row component for react-window v2
// receives index, style, and all additional props passed via rowProps
function Row({
	index,
	style,
	itemComponent,
	items,
	query,
	mode,
	selectedIndex,
	openItem,
	closeTab,
	onHover})
{
	const item = items[index];
	const ItemComponent = item.component || itemComponent;

	return <ItemComponent
		item={item}
		index={index}
		query={query}
		mode={mode}
		isSelected={selectedIndex == index}
		openItem={openItem}
		closeTab={closeTab}
		onHover={onHover}
		style={style}
	/>
}


export default class ResultsList extends React.Component {
    startIndex = 0;
    stopIndex = 0;
    listRef = React.createRef();
	renderTimer = null;
	hoverSelectEnabled = false;
	listWidth = getListWidth();


	componentDidMount()
	{
		this.handleResize = () => {
			const newWidth = getListWidth();

			if (newWidth !== this.listWidth) {
				this.listWidth = newWidth;
				this.forceUpdate();
			}
		};

		window.addEventListener("resize", this.handleResize);
	}


	componentWillUnmount()
	{
		window.removeEventListener("resize", this.handleResize);
	}


	componentDidUpdate(
		prevProps)
	{
		const itemsChanged = prevProps.items !== this.props.items;

		if (itemsChanged || prevProps.selectedIndex !== this.props.selectedIndex) {
				// react-window v2 uses imperative scrollToRow on the list ref
			const {selectedIndex} = this.props;

			if (this.listRef.current && selectedIndex >= 0 && selectedIndex < this.props.items.length) {
				this.listRef.current.scrollToRow({
					index: selectedIndex,
					align: "smart"
				});
			}
		}

			// react-window v2 List is a function component that manages its own
			// DOM ref internally; set tabIndex on it once available
		if (this.listRef.current && this.listRef.current.element) {
			this.listRef.current.element.tabIndex = -1;
		}

		if (itemsChanged || (!prevProps.visible && this.props.visible)) {
			this.enableHoverSelectDelayed();
		} else if (prevProps.visible && !this.props.visible) {
				// make sure the timer is cleared when the popup is hidden
			this.disableHoverSelect();
		}
	}


	scrollByPage(
		direction)
	{
		const {items: {length: itemCount}, maxItems, setSelectedIndex} = this.props;
		const rowCount = Math.min(maxItems, itemCount) - 1;
		let {selectedIndex} = this.props;

		if (direction == "down") {
			if (selectedIndex == this.stopIndex) {
				selectedIndex = Math.min(selectedIndex + rowCount, itemCount - 1);
			} else {
				selectedIndex = this.stopIndex;
			}
		} else {
			if (selectedIndex == this.startIndex) {
				selectedIndex = Math.max(selectedIndex - rowCount, 0);
			} else {
				selectedIndex = this.startIndex;
			}
		}

		setSelectedIndex(selectedIndex);
	}


	scrollToRow(
		index)
	{
		if (this.listRef.current && index >= 0 && index < this.props.items.length) {
			this.listRef.current.scrollToRow({ index, align: "smart" });
		}
	}


	enableHoverSelectDelayed()
	{
		this.disableHoverSelect();
		this.renderTimer = setTimeout(this.handleRenderTimerDone, MinShownTime);
	}


	disableHoverSelect()
	{
		clearTimeout(this.renderTimer);
		this.hoverSelectEnabled = false;
		this.renderTimer = null;
	}


	handleRenderTimerDone = () =>
	{
		this.hoverSelectEnabled = true;
		this.renderTimer = null;
	}


	handleItemHovered = (
		index) =>
	{
		if (this.hoverSelectEnabled && index !== this.props.selectedIndex) {
				// pass true so the app treats a mouse selection like one
				// made by the MRU key, so that the user can press the menu
				// shortcut, highlight a tab with the mouse, and then
				// release alt to select it
			this.props.setSelectedIndex(index, true);
		}
	};



    handleRowsRendered = (
		visibleRows) =>
	{
			// track the visible rendered rows so we know how to change the
			// selection when the App tells us to page up/down, since it
			// doesn't know what's visible
		this.startIndex = visibleRows.startIndex;
		this.stopIndex = visibleRows.stopIndex;
	};


    render()
	{
		const {
			items,
			maxItems,
			selectedIndex,
			itemComponent,
			query,
			mode,
			openItem,
			closeTab
		} = this.props;
		const itemCount = items.length;
		const height = Math.min(itemCount, maxItems) * ResultsListRowHeight;
		const style = {
			display: height ? "block" : "none",
			width: this.listWidth
		};

			// pass all item-rendering data via rowProps so that react-window
			// can detect changes and re-render rows automatically
		const rowProps = {
			itemComponent,
			items,
			query,
			mode,
			selectedIndex,
			openItem,
			closeTab,
			onHover: this.handleItemHovered
		};

		return <div className="results-list-container"
			style={style}
		>
			<List
				listRef={this.listRef}
				className="results-list"
				rowComponent={Row}
				rowProps={rowProps}
				rowCount={itemCount}
				rowHeight={ResultsListRowHeight}
				onRowsRendered={this.handleRowsRendered}
				style={{ height }}
			/>
		</div>
	}
}
