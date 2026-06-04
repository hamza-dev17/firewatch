import { useEffect, useState } from "react";
import { DataSourceTag } from "../../components/DataSourceTag";
import { formatReadingLabel, formatReadingValue, readingEntries } from "../../dashboard/formatters";
import type { AssessmentPayload, LocationSearchResult } from "../../dashboard/types";
import { ActionBox } from "./ActionBox";
import { CollapsibleSection } from "./CollapsibleSection";
import { ForecastStrip } from "./ForecastStrip";
import { RiskHero } from "./RiskHero";
import { WeatherGrid } from "./WeatherGrid";

type DecisionSupportPanelProps = {
  assessmentPayload: AssessmentPayload | null;
  isAssessing: boolean;
  location: LocationSearchResult | null;
  onClose: () => void;
};

export const DecisionSupportPanel = ({
  assessmentPayload,
  isAssessing,
  location,
  onClose,
}: DecisionSupportPanelProps) => {
  const [selectedForecastIndex, setSelectedForecastIndex] = useState(0);

  useEffect(() => {
    setSelectedForecastIndex(0);
  }, [location?.display_name]);

  const assessment = assessmentPayload?.forecast_assessments?.[selectedForecastIndex] ?? assessmentPayload?.forecast_assessments?.[0];
  const forecastAssessments = assessmentPayload?.forecast_assessments ?? [];
  const weatherSource = assessmentPayload?.data_source_labels?.weather;
  const modelAlgorithm = assessment?.model_algorithm ?? assessmentPayload?.model_algorithm ?? "Default";

  return (
    <aside aria-label="Decision support" className="decision-support-panel">
      <header className="decision-support-header">
        <div>
          <div className="panel-status-strip">
            <p className="panel-kicker">Decision support</p>
            <span><i aria-hidden="true" /> Live assessment</span>
          </div>
          <h2>{location?.display_name ?? "Selected location"}</h2>
        </div>
        <button aria-label="Close decision support" onClick={onClose} type="button">x</button>
      </header>

      {isAssessing ? <p className="panel-message">Building live assessment...</p> : null}
      {!isAssessing && assessmentPayload?.message ? (
        <p className="panel-message">{assessmentPayload.message}</p>
      ) : null}

      {assessment ? (
        <>
          <RiskHero assessment={assessment} />
          <ForecastStrip
            assessments={forecastAssessments}
            selectedIndex={selectedForecastIndex}
            onSelect={setSelectedForecastIndex}
          />
          <WeatherGrid assessment={assessment} source={weatherSource} />
          <div className="data-source-list" aria-label="Data source labels">
            <DataSourceTag label="Assessment" source={assessmentPayload?.data_source_labels?.assessment} />
            <DataSourceTag label="Narrative" source={assessmentPayload?.data_source_labels?.narrative} />
          </div>
          <ActionBox
            action={assessment.recommended_action}
            monitoringRadius={assessment.monitoring_radius}
            riskLevel={assessment.risk_level}
          />
          {assessment.narrative_explanation ? (
            <section className="briefing-block">
              <p className="panel-kicker">Operational briefing</p>
              <p>{assessment.narrative_explanation}</p>
            </section>
          ) : null}
          <CollapsibleSection title="Weather signals">
            <p className="section-note">Context signals. Not all are model prediction inputs.</p>
            {readingEntries(assessment.weather_signals).map(([key, value]) => (
              <div className="model-input-row" key={key}>
                <span>{formatReadingLabel(key)}</span>
                <strong>{formatReadingValue(key, value)}</strong>
              </div>
            ))}
          </CollapsibleSection>
          <CollapsibleSection title="Model & dataset">
            <p className="section-note">Runtime features used for this Prototype Relative Wildfire Risk assessment.</p>
            <div className="model-input-row">
              <span>Selected model</span>
              <strong>{modelAlgorithm}</strong>
            </div>
            {readingEntries(assessment.model_input_drivers).map(([key, value]) => (
              <div className="model-input-row" key={key}>
                <span>{formatReadingLabel(key)}</span>
                <strong>{formatReadingValue(key, value)}</strong>
              </div>
            ))}
            <p className="transfer-limitation">
              Transfer limitation: Morocco proxy dataset applied to Turkiye. Not validated for operational accuracy.
            </p>
          </CollapsibleSection>
        </>
      ) : null}
    </aside>
  );
};
