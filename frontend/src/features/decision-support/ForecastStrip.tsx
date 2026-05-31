import { formatForecastWindow, formatLabel } from "../../dashboard/formatters";
import type { AssessmentWindowResult } from "../../dashboard/types";

type ForecastStripProps = {
  assessments: AssessmentWindowResult[];
};

export const ForecastStrip = ({ assessments }: ForecastStripProps) => (
  <div aria-label="Forecast windows" className="forecast-strip" role="group">
    {assessments.map((assessment, index) => (
      <div className={`forecast-window${index === 0 ? " active" : ""}`} key={assessment.forecast_window}>
        <span>{formatForecastWindow(assessment.forecast_window)}</span>
        <strong className={`risk-${assessment.risk_level}`}>{formatLabel(assessment.risk_level)}</strong>
      </div>
    ))}
  </div>
);
