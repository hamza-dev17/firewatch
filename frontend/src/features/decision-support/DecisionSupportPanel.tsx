import { type FormEvent, useEffect, useState } from "react";
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
  const narrativeLines = cleanBriefingText(narrative)
    .split(/(?<=[.!?])\s+/)
    .map((line) => sentenceWithPeriod(line.trim()))
    .filter(Boolean);

  if (narrativeLines.length) {
    return narrativeLines;
  }

  const place = locationName || "the selected location";
  const forecastWindow = formatForecastWindow(assessment.forecast_window).toLowerCase();
  const temperature = getAssessmentReading(assessment, "temperature_c");
  const wind = getAssessmentReading(assessment, "wind_speed_mps");
  const rain = getAssessmentReading(assessment, "rain_mm");

  const conditions = [
    temperature ? `temperature input at ${temperature}` : null,
    wind ? `wind input at ${wind}` : null,
    rain === "0 mm" ? "no rainfall input" : rain ? `rainfall input at ${rain}` : null,
  ].filter(Boolean);

  const lines = [
    `${formatLabel(assessment.risk_level)} relative wildfire risk is reported for ${place} in the ${forecastWindow} forecast window, with a ${assessment.risk_trend ?? "stable"} risk trend.`,
  ];

  if (conditions.length) {
    lines.push(`Model input drivers include ${conditions.join(", ")}.`);
  }

  lines.push(
    `${sentenceWithPeriod(`Approved recommended action: ${sentenceCase(assessment.recommended_action)}`)} Monitor within the ${assessment.monitoring_radius} advisory radius.`,
  );

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

const SUGGESTED_ASSISTANT_QUESTIONS = [
  "Why is this high?",
  "What factors matter most?",
  "Why did risk increase?",
];

type AssistantAnswer = {
  answer: string;
  answer_source_label: string;
  answer_source_state?: string;
  supported_question: boolean;
};

const AssessmentAssistant = ({
  assessment,
  dataSourceLabels,
  forecastAssessments,
  locationName,
}: {
  assessment: AssessmentWindowResult;
  dataSourceLabels?: AssessmentPayload["data_source_labels"];
  forecastAssessments: AssessmentWindowResult[];
  locationName?: string;
}) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const assistantStatusLabel = isAsking ? "Checking" : answer ? formatLabel(answer.answer_source_label) : "Ready";

  useEffect(() => {
    setQuestion("");
    setAnswer(null);
    setIsAsking(false);
  }, [assessment.forecast_window, locationName]);

  const askQuestion = async (nextQuestion: string) => {
    const cleanedQuestion = nextQuestion.trim();
    if (!cleanedQuestion) {
      return;
    }

    setQuestion(cleanedQuestion);
    setIsAsking(true);
    setAnswer(null);

    try {
      const response = await fetch("/api/assessment-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanedQuestion,
          location_name: locationName,
          forecast_window: assessment.forecast_window,
          assessment,
          forecast_assessments: forecastAssessments,
          data_source_labels: dataSourceLabels ?? {},
        }),
      });

      if (!response.ok) {
        throw new Error("Assistant request failed.");
      }

      setAnswer((await response.json()) as AssistantAnswer);
    } catch {
      setAnswer({
        answer: "Assessment assistant is unavailable for this Forecast Window. Use the Operational Briefing Text and visible assessment facts.",
        answer_source_label: "unavailable",
        supported_question: false,
      });
    } finally {
      setIsAsking(false);
    }
  };

  const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void askQuestion(question);
  };

  return (
    <section className="assessment-assistant" aria-label="Ask about this assessment">
      <div className="assistant-heading">
        <div>
          <p className="panel-kicker">Ask about this assessment</p>
          <span>{formatForecastWindow(assessment.forecast_window)} Forecast Window</span>
        </div>
        <strong>Assistant: {assistantStatusLabel}</strong>
      </div>

      <div className="assistant-chip-row" aria-label="Suggested assessment questions">
        {SUGGESTED_ASSISTANT_QUESTIONS.map((suggestedQuestion) => (
          <button
            key={suggestedQuestion}
            onClick={() => void askQuestion(suggestedQuestion)}
            type="button"
          >
            {suggestedQuestion}
          </button>
        ))}
      </div>

      <form className="assistant-question-form" onSubmit={submitQuestion}>
        <input
          aria-label="Assessment assistant question"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this Forecast Window"
          type="text"
          value={question}
        />
        <button disabled={isAsking || !question.trim()} type="submit">
          Ask
        </button>
      </form>

      <div className="assistant-answer" role="status" aria-live="polite">
        {isAsking ? <p>Checking selected assessment facts...</p> : null}
        {!isAsking && answer ? <p>{answer.answer}</p> : null}
        {!isAsking && !answer ? (
          <p>Answers are limited to this selected Wildfire Risk Assessment and Forecast Window.</p>
        ) : null}
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
          <AssessmentAssistant
            assessment={assessment}
            dataSourceLabels={assessmentPayload?.data_source_labels}
            forecastAssessments={forecastAssessments}
            locationName={location?.display_name}
          />
        </>
      ) : null}
    </aside>
  );
};
