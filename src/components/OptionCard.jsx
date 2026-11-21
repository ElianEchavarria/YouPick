// One restaurant: photo, name and the facts people decide on.
// Pass onClick to make it tappable (used for ranking).

import { priceLabel } from "../../shared/catalog.js";

export default function OptionCard({ option, sessionId, rank, onClick, large = false }) {
  const facts = [
    option.rating != null && `★ ${option.rating.toFixed(1)}${option.reviews ? ` (${option.reviews.toLocaleString()})` : ""}`,
    priceLabel(option.price),
    `${option.distanceMiles} mi`,
    option.cuisine,
  ].filter(Boolean);

  const content = (
    <>
      {option.hasPhoto ? (
        // The server redirects this to the Google photo, so the API key
        // never appears in the page.
        <img className="photo" src={`/api/sessions/${sessionId}/photo/${option.id}`} alt="" loading="lazy" />
      ) : (
        <div className="photo placeholder" aria-hidden="true">
          {option.name.charAt(0)}
        </div>
      )}
      <div className="option-body">
        <p className="option-name">{option.name}</p>
        <p className="muted small">{facts.join(" · ")}</p>
        {large && option.address && <p className="muted small">{option.address}</p>}
      </div>
      {rank != null && <span className="rank">{rank}</span>}
    </>
  );

  const className = `option${large ? " large" : ""}${rank != null ? " ranked" : ""}`;

  return onClick ? (
    <button type="button" className={className} onClick={onClick} aria-pressed={rank != null}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
