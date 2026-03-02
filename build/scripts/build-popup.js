import React from "react";
import * as ReactDOMServer from "react-dom/server";
import App from "@/popup/app";

	// make the text red using escape codes
const ChangeWarning = ["\x1b[31m%s\x1b[0m", `

================================

    Popup markup has changed

================================

`];
const root = (contents) => `<div id="root">${contents}</div>`;
const rootPattern = new RegExp(root("(.+)"));

// SSG pre-rendering is no longer needed since the popup uses createRoot()
// instead of hydrateRoot(). This script simply returns the original HTML.
export default function render({ fs })
{
	return fs.readFileSync("./src/popup.html", "utf8");
}
