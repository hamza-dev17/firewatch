type ActionBoxProps = {
  action: string;
  monitoringRadius: string;
  riskLevel: string;
};

export const ActionBox = ({ action, monitoringRadius, riskLevel }: ActionBoxProps) => {
  return (
    <section className={`action-box risk-${riskLevel}`}>
      <p className="panel-kicker">Recommended action</p>
      <strong>{action}</strong>
      <div className="monitoring-radius">
        <span>Advisory radius</span>
        <strong>{monitoringRadius}</strong>
      </div>
    </section>
  );
};
