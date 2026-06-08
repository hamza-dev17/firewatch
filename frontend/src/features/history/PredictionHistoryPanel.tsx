import { useState } from "react";

import { formatLabel } from "../../dashboard/formatters";
import type { HistoryFilters } from "../../dashboard/usePredictionHistory";
import type { AssessmentWindowResult, PredictionHistoryRecord } from "../../dashboard/types";

type PredictionHistoryPanelProps = {
  isLoading: boolean;
  message: string | null;
  onArchiveRecord: (recordId: string) => void;
  onApplyFilters: (filters: HistoryFilters) => void;
  records: PredictionHistoryRecord[];
};

type SortKey = "timestamp" | "location" | "risk" | "score";
type SortDir = "asc" | "desc";

const RISK_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const formatTimestamp = (ts: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));

const topAssessment = (record: PredictionHistoryRecord, appliedRiskLevel?: string): AssessmentWindowResult | undefined => {
  if (appliedRiskLevel) {
    const match = record.forecast_assessments.find((a) => a.risk_level.toLowerCase() === appliedRiskLevel.toLowerCase());
    if (match) return match;
  }
  return record.forecast_assessments.reduce<AssessmentWindowResult | undefined>((best, a) => {
    if (!best) return a;
    return (RISK_ORDER[a.risk_level] ?? 0) > (RISK_ORDER[best.risk_level] ?? 0) ? a : best;
  }, undefined);
};

const RiskBar = ({ score }: { score: number }) => {
  const pct = Math.round(score * 100);
  const color =
    pct >= 75 ? "var(--risk-critical)" :
    pct >= 50 ? "var(--risk-high)" :
    pct >= 25 ? "var(--risk-medium)" : "var(--risk-low)";
  return (
    <div className="hr-score-wrap" title={`Risk score: ${pct}`}>
      <div className="hr-score-bar" style={{ width: `${pct}%`, background: color }} />
      <span className="hr-score-label">{pct}</span>
    </div>
  );
};

const RiskBadge = ({ level }: { level: string }) => (
  <span className={`hr-badge hr-badge--${level}`}>{formatLabel(level)}</span>
);

export const PredictionHistoryPanel = ({
  isLoading,
  message,
  onArchiveRecord,
  onApplyFilters,
  records,
}: PredictionHistoryPanelProps) => {
  // filter state
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [appliedRiskLevel, setAppliedRiskLevel] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // sort + expand
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const applyFilters = (overrides: Partial<HistoryFilters> = {}) => {
    const finalRiskLevel = overrides.riskLevel !== undefined ? overrides.riskLevel : (riskLevel || undefined);
    setAppliedRiskLevel(finalRiskLevel || "");
    onApplyFilters({
      region: region.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      riskLevel: finalRiskLevel,
      showArchived,
      ...overrides,
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...records].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "timestamp") {
      cmp = new Date(a.assessment_timestamp).getTime() - new Date(b.assessment_timestamp).getTime();
    } else if (sortKey === "location") {
      cmp = (a.location.name ?? "").localeCompare(b.location.name ?? "");
    } else if (sortKey === "risk") {
      cmp = (RISK_ORDER[topAssessment(a, appliedRiskLevel)?.risk_level ?? ""] ?? 0) -
            (RISK_ORDER[topAssessment(b, appliedRiskLevel)?.risk_level ?? ""] ?? 0);
    } else if (sortKey === "score") {
      cmp = (topAssessment(a, appliedRiskLevel)?.risk_score ?? 0) - (topAssessment(b, appliedRiskLevel)?.risk_score ?? 0);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className={`hr-sort-icon${sortKey === col ? " active" : ""}`} aria-hidden="true">
      {sortKey === col ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );

  // active filter chips
  const chips: { label: string; clear: () => void }[] = [];
  if (region) chips.push({ label: `Region: ${region}`, clear: () => { setRegion(""); applyFilters({ region: undefined }); } });
  if (startDate) chips.push({ label: `From: ${startDate}`, clear: () => { setStartDate(""); applyFilters({ startDate: undefined }); } });
  if (endDate) chips.push({ label: `To: ${endDate}`, clear: () => { setEndDate(""); applyFilters({ endDate: undefined }); } });
  if (riskLevel) chips.push({ label: `Risk: ${formatLabel(riskLevel)}`, clear: () => { setRiskLevel(""); applyFilters({ riskLevel: undefined }); } });
  if (showArchived) chips.push({ label: "Showing archived", clear: () => { setShowArchived(false); applyFilters({ showArchived: false }); } });

  return (
    <section className="history-panel" aria-label="Prediction History">
      {/* ── Header ── */}
      <header className="history-panel-header">
        <div>
          <p className="panel-kicker">Prediction History</p>
          <h2>Past assessments</h2>
        </div>
        <div className="hp-meta">
          <span className="hp-count">{records.length} records</span>
          {records.some((r) => r.archived_at) && (
            <span className="hp-archived-count">
              {records.filter((r) => r.archived_at).length} archived
            </span>
          )}
        </div>
      </header>

      {/* ── Filter bar ── */}
      <form
        className="history-filters"
        onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
      >
        <label>
          Region
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            type="text"
            placeholder="e.g. Aegean"
          />
        </label>
        <label>
          Start date
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" />
        </label>
        <label>
          End date
          <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" />
        </label>
        <label>
          Risk level
          <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
            <option value="">Any</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <div className="history-toggle">
          <span>Show archived</span>
          <button
            type="button"
            role="switch"
            aria-checked={showArchived}
            aria-label="Show archived"
            className={`toggle-switch${showArchived ? " on" : ""}`}
            onClick={() => {
              const v = !showArchived;
              setShowArchived(v);
              applyFilters({ showArchived: v });
            }}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
        <button type="submit">Apply filters</button>
      </form>

      {/* ── Active filter chips ── */}
      {chips.length > 0 && (
        <div className="hp-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="hp-chip"
              onClick={chip.clear}
              aria-label={`Remove filter: ${chip.label}`}
            >
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            className="hp-chip hp-chip--clear-all"
            onClick={() => {
              setRegion(""); setStartDate(""); setEndDate("");
              setRiskLevel(""); setShowArchived(false);
              onApplyFilters({});
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Status messages ── */}
      {isLoading && (
        <div className="hp-status">
          <span className="hp-status-spinner" aria-hidden="true" />
          Loading prediction history…
        </div>
      )}
      {!isLoading && message && <p className="panel-message">{message}</p>}
      {!isLoading && !message && records.length === 0 && (
        <p className="panel-message">No records match the current filters.</p>
      )}

      {/* ── Table ── */}
      {sorted.length > 0 && (
        <div className="hp-table-wrap">
          <table className="hp-table" aria-label="Assessment history">
            <thead>
              <tr>
                <th scope="col" className="hp-th hp-th--status">Status</th>
                <th scope="col" className="hp-th hp-th--sortable" onClick={() => handleSort("location")}>
                  Location <SortIcon col="location" />
                </th>
                <th scope="col" className="hp-th hp-th--sortable" onClick={() => handleSort("timestamp")}>
                  Assessed <SortIcon col="timestamp" />
                </th>
                <th scope="col" className="hp-th hp-th--sortable" onClick={() => handleSort("risk")}>
                  Risk level <SortIcon col="risk" />
                </th>
                <th scope="col" className="hp-th hp-th--sortable" onClick={() => handleSort("score")}>
                  Score <SortIcon col="score" />
                </th>
                <th scope="col" className="hp-th">Window</th>
                <th scope="col" className="hp-th">Recommended action</th>
                <th scope="col" className="hp-th hp-th--actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((record) => {
                const assessment = topAssessment(record, appliedRiskLevel);
                const isExpanded = expandedId === record.id;
                const hasMultiple = record.forecast_assessments.length > 1;

                return (
                  <>
                    <tr
                      key={record.id}
                      className={`hp-row${record.archived_at ? " hp-row--archived" : ""}${isExpanded ? " hp-row--expanded" : ""}`}
                      onClick={() => hasMultiple && setExpandedId(isExpanded ? null : record.id)}
                      style={{ cursor: hasMultiple ? "pointer" : undefined }}
                    >
                      <td className="hp-td">
                        {record.archived_at ? (
                          <span className="hr-status hr-status--archived">Archived</span>
                        ) : (
                          <span className="hr-status hr-status--active">Active</span>
                        )}
                      </td>
                      <td className="hp-td hp-td--location">
                        <span className="hr-location-name">
                          {record.location.name ?? "Unknown location"}
                        </span>
                        <span className="hr-coords">
                          {record.location.latitude.toFixed(4)}, {record.location.longitude.toFixed(4)}
                        </span>
                      </td>
                      <td className="hp-td hp-td--mono">
                        {formatTimestamp(record.assessment_timestamp)}
                      </td>
                      <td className="hp-td">
                        {assessment ? <RiskBadge level={assessment.risk_level} /> : "—"}
                      </td>
                      <td className="hp-td hp-td--score">
                        {assessment ? <RiskBar score={assessment.risk_score} /> : "—"}
                      </td>
                      <td className="hp-td hp-td--mono">
                        {assessment ? formatLabel(assessment.forecast_window) : "—"}
                      </td>
                      <td className="hp-td hp-td--action">
                        {assessment?.recommended_action ?? "—"}
                      </td>
                      <td className="hp-td hp-td--actions">
                        <div className="hp-row-actions">
                          {hasMultiple && (
                            <button
                              type="button"
                              className="hp-icon-btn"
                              aria-label={isExpanded ? "Collapse forecast windows" : "Expand forecast windows"}
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : record.id); }}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          )}
                          {!record.archived_at && (
                            <button
                              type="button"
                              className="hp-action-btn"
                              aria-label={`Archive ${record.location.name ?? "record"}`}
                              onClick={(e) => { e.stopPropagation(); onArchiveRecord(record.id); }}
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded sub-rows for other forecast windows */}
                    {isExpanded && record.forecast_assessments.map((a, i) => (
                      <tr key={`${record.id}-${i}`} className="hp-row hp-row--sub">
                        <td className="hp-td" />
                        <td className="hp-td hp-td--sub-indent" colSpan={1}>
                          <span className="hr-sub-label">└ {formatLabel(a.forecast_window)}</span>
                        </td>
                        <td className="hp-td hp-td--mono" />
                        <td className="hp-td">
                          <RiskBadge level={a.risk_level} />
                        </td>
                        <td className="hp-td hp-td--score">
                          <RiskBar score={a.risk_score} />
                        </td>
                        <td className="hp-td hp-td--mono">{formatLabel(a.forecast_window)}</td>
                        <td className="hp-td hp-td--action">{a.recommended_action}</td>
                        <td className="hp-td" />
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
