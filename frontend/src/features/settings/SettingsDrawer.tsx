import type { ApiStatusPayload, MonitoringOverviewPayload, StatusState } from "../../dashboard/types";
import { formatLabel, formatState } from "../../dashboard/formatters";

type SettingsDrawerProps = {
  overview: MonitoringOverviewPayload | null;
  statusPayload: ApiStatusPayload | null;
  selectedModelAlgorithm: string | null;
  onModelAlgorithmChange: (algorithm: string) => void;
  onClose: () => void;
};

const statusClass = (state: StatusState | undefined) => {
  return state === "configured" ? "configured" : "degraded";
};

const integrationState = (statusPayload: ApiStatusPayload | null, key: "mapbox" | "openweather" | "groq") => {
  return statusPayload?.integrations?.[key] ?? "unavailable";
};

const asPercent = (value: number | undefined) => {
  if (typeof value !== "number") {
    return "n/a";
  }
  return `${Math.round(value * 1000) / 10}%`;
};

export const SettingsDrawer = ({
  overview,
  statusPayload,
  selectedModelAlgorithm,
  onModelAlgorithmChange,
  onClose,
}: SettingsDrawerProps) => {
  const modelArtifact = statusPayload?.runtime?.model_artifact;
  const modelEvidence = statusPayload?.runtime?.model_evidence;
  const modelSelection = statusPayload?.runtime?.model_selection;
  const availableAlgorithms = new Set(modelSelection?.available_algorithms ?? []);
  const servingAlgorithms = new Set(modelSelection?.serving_algorithms ?? []);
  const supportedAlgorithms = modelSelection?.supported_algorithms ?? [];
  const candidateModels = modelEvidence?.candidate_models ?? {};
  const selectedEvidenceAlgorithm = modelEvidence?.selected_algorithm ?? null;
  const candidateOrder = Array.from(
    new Set([
      ...(modelEvidence?.candidate_model_ranking ?? []),
      ...Object.keys(candidateModels).sort((a, b) => {
        return (candidateModels[b]?.wildfire_recall ?? 0) - (candidateModels[a]?.wildfire_recall ?? 0);
      }),
      ...supportedAlgorithms,
    ])
  );
  const activeModelAlgorithm = selectedModelAlgorithm ?? selectedEvidenceAlgorithm;
  const modelState = modelArtifact?.state ?? "unavailable";
  const openWeatherState = integrationState(statusPayload, "openweather");
  const hasDegradedStatus =
    overview?.source_state === "degraded" ||
    modelState !== "configured" ||
    openWeatherState !== "configured";
  const degradedMessage =
    overview?.message ??
    "One or more external integrations are unavailable. FIREWATCH DSS must label fallback or cached data.";

  return (
    <aside className="settings-drawer" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-drawer-header">
        <div>
          <p className="panel-kicker">System settings</p>
          <h2>Settings</h2>
        </div>
        <button type="button" aria-label="Close settings" onClick={onClose}>
          x
        </button>
      </div>

      {hasDegradedStatus ? (
        <section className="settings-status degraded" aria-label="Degraded Data Status">
          <strong>Degraded Data Status</strong>
          <p>{degradedMessage}</p>
        </section>
      ) : null}

      <section className="settings-section">
        <h3>Model configuration</h3>
        <div className="settings-row">
          <span>Model artifact</span>
          <strong className={statusClass(modelState)}>{formatState(modelState)}</strong>
        </div>
        <div className="settings-row">
          <span>Artifact path</span>
          <strong>{modelArtifact?.path ?? "Unavailable"}</strong>
        </div>
        <div className="settings-row">
          <span>Threshold version</span>
          <strong>{modelArtifact?.version ?? "Prototype default"}</strong>
        </div>
        {candidateOrder.length ? (
          <ul className="model-selector" aria-label="Model evidence">
            {candidateOrder.map((algorithm) => {
              const metrics = candidateModels[algorithm] ?? {};
              const isDefault = algorithm === selectedEvidenceAlgorithm;
              const isActive = algorithm === activeModelAlgorithm;
              const hasMetrics = Boolean(candidateModels[algorithm]);
              const isAvailable = availableAlgorithms.has(algorithm);
              const isServing = servingAlgorithms.has(algorithm);

              return (
                <li
                  className={isActive ? "active" : undefined}
                  key={algorithm}
                  onClick={() => {
                    if (isServing) {
                      onModelAlgorithmChange(algorithm);
                    }
                  }}
                  style={{ cursor: isServing ? "pointer" : "default" }}
                  role={isServing ? "button" : undefined}
                  tabIndex={isServing ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isServing && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onModelAlgorithmChange(algorithm);
                    }
                  }}
                >
                  <span>
                    {formatLabel(algorithm)}
                    {isActive ? " active assessment model" : ""}
                    {isDefault ? " default model" : ""}
                    {isServing ? " serving-enabled" : " evidence only"}
                    {!isAvailable ? " not packaged" : ""}
                    {!hasMetrics ? " not trained" : ""}
                  </span>
                  <strong>Recall {asPercent(metrics.wildfire_recall)}</strong>
                  <small>F1 {asPercent(metrics.wildfire_f1)} / ROC-AUC {asPercent(metrics.roc_auc)}</small>
                </li>
              );
            })}
            {modelSelection?.message ? <p className="settings-helper">{modelSelection.message}</p> : null}
          </ul>
        ) : null}
      </section>

      <section className="settings-section">
        <h3>Dataset info</h3>
        <div className="settings-note">
          <strong>Transfer Limitation</strong>
          <p>
            Prototype Relative Wildfire Risk is trained with the Morocco Wildfire Dataset, a Proxy Training Dataset,
            then applied to Turkish locations. It is not validated national accuracy for Turkiye.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h3>Integrations status</h3>
        <div className="settings-row">
          <span>Weather Source</span>
          <strong className={statusClass(openWeatherState)}>{formatState(openWeatherState)}</strong>
        </div>
        <div className="settings-row">
          <span>Mapbox Map Workspace</span>
          <strong className={statusClass(integrationState(statusPayload, "mapbox"))}>
            {formatState(integrationState(statusPayload, "mapbox"))}
          </strong>
        </div>
        <div className="settings-row">
          <span>Groq Narrative Provider</span>
          <strong className={statusClass(integrationState(statusPayload, "groq"))}>
            {formatState(integrationState(statusPayload, "groq"))}
          </strong>
        </div>
        <div className="settings-row">
          <span>Monitoring overview</span>
          <strong className={overview?.source_state === "live" ? "configured" : "degraded"}>
            {formatLabel(overview?.source_state)}
          </strong>
        </div>
      </section>
    </aside>
  );
};
