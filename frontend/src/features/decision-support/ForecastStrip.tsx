import { formatForecastWindow, formatLabel } from "../../dashboard/formatters";
import type { AssessmentWindowResult } from "../../dashboard/types";

type ForecastStripProps = {
  assessments: AssessmentWindowResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export const ForecastStrip = ({ assessments, selectedIndex, onSelect }: ForecastStripProps) => (
  <div aria-label="Forecast windows" className="forecast-strip" role="group">
    {assessments.map((assessment, index) => (
      <button
        key={assessment.forecast_window}
        className={`forecast-window${index === selectedIndex ? " active" : ""}`}
        onClick={() => onSelect(index)}
        aria-pressed={index === selectedIndex}
      >
        <span>{formatForecastWindow(assessment.forecast_window)}</span>
        <strong className={`risk-${assessment.risk_level}`}>{formatLabel(assessment.risk_level)}</strong>
      </button>
    ))}
  </div>
);
