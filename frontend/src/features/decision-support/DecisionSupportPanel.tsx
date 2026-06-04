import { useEffect, useState } from "react";
import { DataSourceTag } from "../../components/DataSourceTag";
import {
  formatForecastWindow,
  formatLabel,
  formatReadingLabel,
  formatReadingValue,
  readingEntries,
} from "../../dashboard/formatters";
import type { AssessmentPayload, AssessmentWindowResult, LocationSearchResult } from "../../dashboard/types";
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

const cleanBriefingText = (text: string): string => {
  return text
    .replace(/\*\*/g, "")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const parseBriefingSummary = (text: string): string => {
  const matches = Array.from(text.matchAll(/\*\*([^*]+?)\*\*/g));

  if (!matches.length) {
    return cleanBriefingText(text);
  }

  let summary = "";

  matches.forEach((match, index) => {
    const rawLabel = match[1] ?? "";
    const nextMatch = matches[index + 1];
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd = nextMatch?.index ?? text.length;
    const label = rawLabel.replace(/:$/, "").trim();
    const value = cleanBriefingText(text.slice(valueStart, valueEnd)).replace(/^[:\-\s]+/, "").trim();

    if (!label || !value) {
      return;
    }

    if (!summary && /^operational briefing$/i.test(label)) {
      summary = value;
    }
  });

  return summary || cleanBriefingText(text.replace(/\*\*[^*]+?\*\*/g, " "));
};

const sentenceWithPeriod = (text: string): string => {
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const sentenceCase = (text: string): string => {
  const cleaned = text.trim();

  if (!cleaned) {
    return cleaned;
  }

  return cleaned[0].toUpperCase() + cleaned.slice(1);
};

const getAssessmentReading = (assessment: AssessmentWindowResult, key: string): string | null => {
  const value = assessment.model_input_drivers?.[key] ?? assessment.weather_signals?.[key];
  const formattedValue = formatReadingValue(key, value ?? null);

  return formattedValue === "Not available" ? null : formattedValue;
};

const buildOperatorBriefing = (
  assessment: AssessmentWindowResult,
  locationName: string | undefined,
  narrative: string,
): string[] => {
  const place = locationName || "the selected location";
  const forecastWindow = formatForecastWindow(assessment.forecast_window).toLowerCase();
  const temperature = getAssessmentReading(assessment, "temperature_c");
  const humidity = getAssessmentReading(assessment, "humidity_pct");
  const wind = getAssessmentReading(assessment, "wind_speed_mps");
  const rain = getAssessmentReading(assessment, "rain_mm");
  const weather = getAssessmentReading(assessment, "weather_description");

  const conditions = [
    weather ? `weather is ${weather.toLowerCase()}` : null,
    temperature ? `temperature is ${temperature}` : null,
    humidity ? `humidity is ${humidity}` : null,
    wind ? `wind is ${wind}` : null,
    rain === "0 mm" ? "no rain is recorded" : rain ? `rainfall is ${rain}` : null,
  ].filter(Boolean);

  const lines = [
    `${formatLabel(assessment.risk_level)} relative wildfire risk is reported for ${place} in the ${forecastWindow} forecast window.`,
  ];

  if (conditions.length) {
    lines.push(`Current conditions: ${conditions.join(", ")}.`);
  }

  lines.push(
    `${sentenceWithPeriod(`Recommended action: ${sentenceCase(assessment.recommended_action)}`)} Monitor within the ${assessment.monitoring_radius} advisory radius.`,
  );

  if (!lines.length) {
    return [parseBriefingSummary(narrative)].filter(Boolean);
  }

  return lines.map(sentenceWithPeriod);
};

const BriefingBlock = ({
  assessment,
  locationName,
  narrative,
}: {
  assessment: AssessmentWindowResult;
  locationName?: string;
  narrative: string;
}) => {
  const operatorBriefing = buildOperatorBriefing(assessment, locationName, narrative);

  return (
    <section className="briefing-block">
      <div className="briefing-heading">
        <p className="panel-kicker">Operational briefing</p>
        <span aria-hidden="true">Brief</span>
      </div>
      <div className="briefing-copy">
        {operatorBriefing.map((line) => (
          <p className="briefing-summary" key={line}>{line}</p>
        ))}
      </div>
    </section>
  );
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
            <BriefingBlock
              assessment={assessment}
              locationName={location?.display_name}
              narrative={assessment.narrative_explanation}
            />
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
