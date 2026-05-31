import type { ActiveRiskAlert, MonitoringOverviewPayload } from "../../dashboard/types";

type MonitoringRailProps = {
  alerts: ActiveRiskAlert[];
  overview: MonitoringOverviewPayload | null;
};

const RISK_LEVELS = ["critical", "high", "medium", "low"];

const getRegionCount = (overview: MonitoringOverviewPayload | null, riskLevel: string) =>
  overview?.regional_summaries?.filter((summary) => summary.risk_level.toLowerCase() === riskLevel).length ?? 0;

const formatRegionCount = (count: number) => `${count} ${count === 1 ? "REGION" : "REGIONS"}`;
const formatRiskScore = (riskScore?: number) => typeof riskScore === "number" ? `${Math.round(riskScore * 100)}%` : "--";
const formatAssessedAt = (assessedAt?: string) => assessedAt ? new Date(assessedAt).toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit",
}) : "--";

export const MonitoringRail = ({ alerts, overview }: MonitoringRailProps) => (
  <aside className="monitoring-rail" aria-label="Ambient monitoring">
    <section className="rail-card">
      <h2>RISK OVERVIEW</h2>
      {RISK_LEVELS.map((riskLevel) => (
        <div className="rail-row" key={riskLevel}>
          <span>{riskLevel}</span>
          <strong className={riskLevel}>{formatRegionCount(getRegionCount(overview, riskLevel))}</strong>
        </div>
      ))}
    </section>
    <section className="rail-card">
      <h2>LIVE REGIONAL ASSESSMENTS</h2>
      {overview?.regional_summaries?.length ? overview.regional_summaries.map((summary) => (
        <div className="regional-risk-row" key={summary.region}>
          <span>{summary.region}</span>
          <strong className={summary.risk_level.toLowerCase()}>{summary.risk_level.toUpperCase()}</strong>
          <small>{formatRiskScore(summary.risk_score)}</small>
          <time dateTime={summary.assessed_at}>{formatAssessedAt(summary.assessed_at)}</time>
        </div>
      )) : <p className="rail-empty">No live regional assessments yet</p>}
      <p className="rail-note">Latest live assessments</p>
    </section>
    <section className="rail-card">
      <h2>ACTIVE RISK ALERTS</h2>
      {alerts.length ? alerts.map((alert) => (
        <div className="active-alert-row" key={alert.id}>
          <i className={`risk-dot ${alert.risk_level.toLowerCase()}`} aria-hidden="true" />
          <span>{alert.location_name}</span>
          <strong className={alert.risk_level.toLowerCase()}>{alert.risk_level.toUpperCase()}</strong>
          <small>{alert.forecast_window.toUpperCase()}</small>
        </div>
      )) : <p className="rail-empty">No active risk alerts</p>}
      <p className="rail-note">System-generated risk alerts</p>
    </section>
  </aside>
);
