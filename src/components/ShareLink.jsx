import { useState } from "react";
import { copyText } from "../clipboard.js";

export default function ShareLink({ sessionId, title }) {
  const url = `${window.location.origin}/s/${sessionId}`;
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function"; // phones have a native share sheet

  async function copy() {
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="share">
      <code className="share-url">{url.replace(/^https?:\/\//, "")}</code>
      <div className="row">
        <button type="button" className="button" onClick={copy}>
          {copied ? "Copied!" : "Copy link"}
        </button>
        {canShare && (
          <button
            type="button"
            className="button secondary"
            onClick={() => navigator.share({ title, text: `Help pick: ${title}`, url }).catch(() => {})}
          >
            Share…
          </button>
        )}
      </div>
    </div>
  );
}
