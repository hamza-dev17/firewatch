import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsDrawer } from "./SettingsDrawer";

describe("SettingsDrawer", () => {
  it("renders candidate models as evidence and only marks serving models as live-assessment eligible", () => {
    const onModelAlgorithmChange = vi.fn();

    render(
      <SettingsDrawer
        overview={null}
        selectedModelAlgorithm="extra_trees"
        onModelAlgorithmChange={onModelAlgorithmChange}
        onClose={vi.fn()}
        statusPayload={{
          integrations: {
            openweather: "configured",
            mapbox: "configured",
            groq: "configured",
          },
          runtime: {
            model_artifact: {
              state: "configured",
              path: "ml/artifacts/model.joblib",
              version: "runtime-morocco-proxy-v1-thresholds",
            },
            model_evidence: {
              selected_algorithm: "extra_trees",
              candidate_model_ranking: ["extra_trees", "random_forest", "logistic_regression"],
              candidate_models: {
                extra_trees: {
                  wildfire_recall: 0.9,
                  wildfire_f1: 0.86,
                  roc_auc: 0.93,
                },
                random_forest: {
                  wildfire_recall: 0.81,
                  wildfire_f1: 0.82,
                  roc_auc: 0.9,
                },
                logistic_regression: {
                  wildfire_recall: 0.6,
                  wildfire_f1: 0.59,
                  roc_auc: 0.64,
                },
              },
            },
            model_selection: {
              state: "configured",
              supported_algorithms: [
                "logistic_regression",
                "random_forest",
                "extra_trees",
                "gradient_boosting",
                "soft_voting_hybrid",
                "stacking_hybrid",
                "xgboost",
              ],
              available_algorithms: ["random_forest"],
              serving_algorithms: ["extra_trees"],
              message: "Artifact must be regenerated to enable model switching.",
            },
          },
        }}
      />
    );

    const evidence = screen.getByRole("list", { name: "Model evidence" });
    const randomForest = within(evidence).getByText(/Random Forest/i).closest("li");
    const extraTrees = within(evidence).getByText(/Extra Trees/i).closest("li");
    const xgboost = within(evidence).getByText(/Xgboost/i).closest("li");

    expect(extraTrees).toHaveTextContent("serving-enabled");
    expect(extraTrees).toHaveTextContent("default model");
    expect(extraTrees).toHaveTextContent("active assessment model");
    expect(randomForest).toHaveTextContent("evidence only");
    expect(xgboost).toHaveTextContent("evidence only");
    expect(xgboost).toHaveTextContent("not packaged");
    expect(xgboost).toHaveTextContent("not trained");

    expect(screen.queryByRole("radiogroup", { name: "Assessment model" })).not.toBeInTheDocument();
    fireEvent.click(within(evidence).getByText(/Random Forest/i));
    expect(onModelAlgorithmChange).not.toHaveBeenCalled();
    expect(screen.getByText("Artifact must be regenerated to enable model switching.")).toBeInTheDocument();
  });

  it("shows serving-enabled models without exposing a live assessment toggle", () => {
    const onModelAlgorithmChange = vi.fn();

    render(
      <SettingsDrawer
        overview={null}
        selectedModelAlgorithm="stacking_hybrid"
        onModelAlgorithmChange={onModelAlgorithmChange}
        onClose={vi.fn()}
        statusPayload={{
          integrations: {
            openweather: "configured",
            mapbox: "configured",
            groq: "configured",
          },
          runtime: {
            model_artifact: {
              state: "configured",
              path: "ml/artifacts/model.joblib",
              version: "runtime-morocco-proxy-v1-thresholds",
            },
            model_evidence: {
              selected_algorithm: "stacking_hybrid",
              candidate_model_ranking: ["stacking_hybrid", "random_forest", "xgboost"],
              candidate_models: {
                stacking_hybrid: {
                  wildfire_recall: 0.8185,
                  wildfire_f1: 0.8245,
                  roc_auc: 0.9127,
                },
                random_forest: {
                  wildfire_recall: 0.8078,
                  wildfire_f1: 0.8154,
                  roc_auc: 0.9013,
                },
                xgboost: {
                  wildfire_recall: 0.7394,
                  wildfire_f1: 0.702,
                  roc_auc: 0.7699,
                },
              },
            },
            model_selection: {
              state: "configured",
              supported_algorithms: [
                "logistic_regression",
                "random_forest",
                "extra_trees",
                "gradient_boosting",
                "soft_voting_hybrid",
                "stacking_hybrid",
                "xgboost",
              ],
              available_algorithms: [
                "logistic_regression",
                "random_forest",
                "extra_trees",
                "gradient_boosting",
                "soft_voting_hybrid",
                "stacking_hybrid",
                "xgboost",
              ],
              serving_algorithms: ["stacking_hybrid"],
              message: null,
            },
          },
        }}
      />
    );

    const evidence = screen.getByRole("list", { name: "Model evidence" });
    const stackingHybrid = within(evidence).getByText(/Stacking Hybrid/i).closest("li");
    const randomForest = within(evidence).getByText(/Random Forest/i).closest("li");
    const xgboost = within(evidence).getByText(/Xgboost/i).closest("li");

    expect(stackingHybrid).toHaveTextContent("serving-enabled");
    expect(stackingHybrid).toHaveTextContent("default model");
    expect(stackingHybrid).toHaveTextContent("active assessment model");
    expect(randomForest).toHaveTextContent("evidence only");
    expect(xgboost).toHaveTextContent("evidence only");
    expect(randomForest).not.toHaveTextContent("not packaged");
    expect(xgboost).not.toHaveTextContent("not packaged");

    expect(screen.queryByRole("radiogroup", { name: "Assessment model" })).not.toBeInTheDocument();
    fireEvent.click(within(evidence).getByText(/Random Forest/i));
    fireEvent.click(within(evidence).getByText(/Xgboost/i));

    expect(onModelAlgorithmChange).not.toHaveBeenCalled();
  });
});
