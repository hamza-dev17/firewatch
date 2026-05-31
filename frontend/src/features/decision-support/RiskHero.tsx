import { formatConfidence, formatLabel } from "../../dashboard/formatters";
import type { AssessmentWindowResult } from "../../dashboard/types";

type RiskHeroProps = {
  assessment: AssessmentWindowResult;
};

export const RiskHero = ({ assessment }: RiskHeroProps) => {
  const riskLevel = formatLabel(assessment.risk_level);

  return (
    <section className={`risk-hero risk-${assessment.risk_level}`}>
      <p className="panel-kicker">Prototype Relative Wildfire Risk</p>
      <div className="risk-hero-grid">
        <strong className="risk-score">{Math.round(assessment.risk_score * 100)}</strong>
        <div>
          <h2>{riskLevel} relative wildfire risk</h2>
          <span className="risk-trend">{formatLabel(assessment.risk_trend)} trend</span>
          <p>Model confidence {formatConfidence(assessment.model_confidence)}</p>
        </div>
      </div>
    </section>
  );
};
