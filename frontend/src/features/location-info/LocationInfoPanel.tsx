import { DataSourceTag } from "../../components/DataSourceTag";
import {
  formatConfidence,
  formatLabel,
  formatReadingValue,
} from "../../dashboard/formatters";
import type { AssessmentPayload, LocationSearchResult } from "../../dashboard/types";

type LocationInfoPanelProps = {
  assessmentPayload: AssessmentPayload | null;
  isAssessing: boolean;
  location: LocationSearchResult;
  onViewFullAssessment: () => void;
};

export const LocationInfoPanel = ({
  assessmentPayload,
  isAssessing,
  location,
  onViewFullAssessment,
}: LocationInfoPanelProps) => {
  const assessment = assessmentPayload?.forecast_assessments?.[0];
  const temperature = assessment?.model_input_drivers?.temperature_c;
  const windSpeed = assessment?.model_input_drivers?.wind_speed_mps;
  const humidity = assessment?.weather_signals?.humidity_pct;
  const condition = assessment?.weather_signals?.weather_description;

  return (
    <aside aria-label="Selected location" className="location-info-panel">
      <header className="location-info-header">
        <div className="panel-status-strip">
          <p className="panel-kicker">Selected location</p>
          <span><i aria-hidden="true" /> Tracking</span>
        </div>
        <h2>{location.display_name}</h2>
        <p className="location-coordinates">
          {location.latitude.toFixed(4)} / {location.longitude.toFixed(4)}
        </p>
      </header>

      {isAssessing ? <p className="panel-message">Building live assessment...</p> : null}
      {!isAssessing && assessmentPayload?.message ? (
        <p className="panel-message">{assessmentPayload.message}</p>
      ) : null}

      {assessment ? (
        <>
          <section className={`location-risk-banner risk-${assessment.risk_level}`}>
            <strong className="location-risk-score">
              {Math.round(assessment.risk_score * 100)}
              <span>Score</span>
            </strong>
            <div>
              <strong className="location-risk-level">{formatLabel(assessment.risk_level)} risk</strong>
              <p>Conf {formatConfidence(assessment.model_confidence)} / {formatLabel(assessment.risk_trend)} trend</p>
            </div>
          </section>
          <section className="location-weather-grid" aria-label="Weather signals">
            <div>
              <i aria-hidden="true">T</i>
              <span>Temp</span>
              <strong>{formatReadingValue("temperature_c", temperature ?? null)}</strong>
            </div>
            <div>
              <i aria-hidden="true">W</i>
              <span>Wind</span>
              <strong>{formatReadingValue("wind_speed_mps", windSpeed ?? null)}</strong>
            </div>
            <div>
              <i aria-hidden="true">H</i>
              <span>Hum</span>
              <strong>{formatReadingValue("humidity_pct", humidity ?? null)}</strong>
            </div>
          </section>
          {typeof condition === "string" ? <p className="location-condition">{condition}</p> : null}
          <DataSourceTag label="Weather" source={assessmentPayload?.data_source_labels?.weather} />
        </>
      ) : null}

      <button className="panel-primary-action" onClick={onViewFullAssessment} type="button">
        View Full Assessment <span aria-hidden="true">-&gt;</span>
      </button>
    </aside>
  );
};
