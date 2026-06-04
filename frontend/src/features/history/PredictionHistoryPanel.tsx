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

const formatTimestamp = (timestamp: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));

const visibleAssessment = (
  record: PredictionHistoryRecord,
  riskLevel: string
): AssessmentWindowResult | undefined => {
  if (!riskLevel) {
    return record.forecast_assessments[0];
  }

  return (
    record.forecast_assessments.find(
      (assessment) => assessment.risk_level.toLowerCase() === riskLevel.toLowerCase()
    ) ?? record.forecast_assessments[0]
  );
};

export const PredictionHistoryPanel = ({
  isLoading,
  message,
  onArchiveRecord,
  onApplyFilters,
  records,
}: PredictionHistoryPanelProps) => {
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [appliedRiskLevel, setAppliedRiskLevel] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const applyFilters = () => {
    setAppliedRiskLevel(riskLevel);
    onApplyFilters({
      region: region.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      riskLevel: riskLevel || undefined,
      showArchived,
    });
  };

  return (
    <section className="history-panel" aria-label="Prediction History">
      <header className="history-panel-header">
        <div>
          <p className="panel-kicker">Prediction History</p>
          <h2>Past assessments</h2>
        </div>
        <span>{records.length} records</span>
      </header>
      <form
        className="history-filters"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <label>
          Region
          <input value={region} onChange={(event) => setRegion(event.target.value)} type="text" />
        </label>
        <label>
          Start date
          <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" />
        </label>
        <label>
          End date
          <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" />
        </label>
        <label>
          Risk level
          <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
            <option value="">Any</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="history-toggle">
          <input
            checked={showArchived}
            onChange={(event) => {
              const nextShowArchived = event.target.checked;
              setShowArchived(nextShowArchived);
              setAppliedRiskLevel(riskLevel);
              onApplyFilters({
                region: region.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                riskLevel: riskLevel || undefined,
                showArchived: nextShowArchived,
              });
            }}
            type="checkbox"
          />
          Show archived
        </label>
        <button type="submit">Apply filters</button>
      </form>
      {isLoading ? <p className="panel-message">Loading prediction history...</p> : null}
      {!isLoading && message ? <p className="panel-message">{message}</p> : null}
      <div className="history-list">
        {records.map((record) => {
          const assessment = visibleAssessment(record, appliedRiskLevel);
          return (
            <article className="history-record" key={record.id}>
              <div className="history-record-main">
                <div>
                  <h3>{record.location.name ?? "Unknown location"}</h3>
                  <time>{formatTimestamp(record.assessment_timestamp)}</time>
                </div>
                {assessment ? (
                  <strong className={`risk-${assessment.risk_level}`}>{formatLabel(assessment.risk_level)}</strong>
                ) : null}
              </div>
              <div className="history-record-actions">
                {record.archived_at ? <span>Archived</span> : null}
                {!record.archived_at ? (
                  <button
                    aria-label={`Archive ${record.location.name ?? "history record"}`}
                    onClick={() => onArchiveRecord(record.id)}
                    type="button"
                  >
                    Archive
                  </button>
                ) : null}
              </div>
              {assessment ? (
                <dl className="history-record-grid">
                  <div>
                    <dt>Risk score</dt>
                    <dd>{Math.round(assessment.risk_score * 100)}</dd>
                  </div>
                  <div>
                    <dt>Window</dt>
                    <dd>{formatLabel(assessment.forecast_window)}</dd>
                  </div>
                  <div>
                    <dt>Action</dt>
                    <dd>{assessment.recommended_action}</dd>
                  </div>
                </dl>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};
