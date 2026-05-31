import { DataSourceTag } from "../../components/DataSourceTag";
import { formatReadingLabel, formatReadingValue } from "../../dashboard/formatters";
import type { AssessmentWindowResult } from "../../dashboard/types";

type WeatherGridProps = {
  assessment: AssessmentWindowResult;
  source?: string;
};

export const WeatherGrid = ({ assessment, source }: WeatherGridProps) => {
  const readings = [
    ["temperature_c", assessment.model_input_drivers?.temperature_c],
    ["humidity_pct", assessment.weather_signals?.humidity_pct],
    ["wind_speed_mps", assessment.model_input_drivers?.wind_speed_mps],
    ["rain_mm", assessment.model_input_drivers?.rain_mm],
  ] as const;

  return (
    <section className="weather-observation">
      <div className="weather-observation-header">
        <p className="panel-kicker">Weather observation</p>
        <DataSourceTag label="Weather" source={source} />
      </div>
      <div aria-label="Weather observation" className="weather-grid" role="group">
        {readings.map(([key, value]) => (
          <div className="weather-cell" key={key}>
            <span>{formatReadingLabel(key)}</span>
            <strong>{formatReadingValue(key, value ?? null)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
};
