// Counts down to the server's deadline. clockOffset corrects for a phone
// whose clock is a bit off, so everyone sees the same time left.

import { useEffect, useState } from "react";

export default function Countdown({ deadline, clockOffset }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer); // stop ticking when the component goes away
  }, []);

  const msLeft = Math.max(0, deadline - (now + clockOffset));
  const minutes = Math.floor(msLeft / 60000);
  const seconds = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0");

  return (
    <p className={`countdown${msLeft < 60000 ? " urgent" : ""}`} role="timer">
      {msLeft > 0 ? `⏱ ${minutes}:${seconds} left` : "⏱ Time's up"}
    </p>
  );
}
