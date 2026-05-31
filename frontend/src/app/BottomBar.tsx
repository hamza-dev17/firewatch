import { useEffect, useState } from "react";

type BottomBarProps = {
  selectedCity: string | null;
};

const formatClock = () =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

export const BottomBar = ({ selectedCity }: BottomBarProps) => {
  const [clock, setClock] = useState(formatClock);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <footer className="bottom-bar" role="status" aria-label="Operational status">
      <span className="bottom-bar-label">FIREWATCH</span>
      <i className="bottom-bar-separator" aria-hidden="true" />
      <span className="bottom-bar-item bottom-bar-alerts"><i className="bottom-bar-dot" aria-hidden="true" />ALERTS 3</span>
      <i className="bottom-bar-separator" aria-hidden="true" />
      <span className="bottom-bar-item"><i className="bottom-bar-dot" aria-hidden="true" />MODEL ONLINE</span>
      <i className="bottom-bar-separator" aria-hidden="true" />
      <span className="bottom-bar-item bottom-bar-refresh">LAST REFRESH LIVE</span>
      <i className="bottom-bar-separator" aria-hidden="true" />
      <span className="bottom-bar-city">{selectedCity?.toUpperCase() ?? "NO LOCATION SELECTED"}</span>
      <span className="bottom-bar-spacer" />
      <time>{clock}</time>
    </footer>
  );
};
