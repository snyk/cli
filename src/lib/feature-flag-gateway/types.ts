export type FeatureFlagsEvaluationResponse = {
  jsonapi?: { version: string };
  data: {
    id: string;
    type: 'feature_flags_evaluation';
    attributes: {
      evaluations: Array<{
        key: string;
        value: boolean;
        reason: string;
      }>;
      evaluatedAt: string;
    };
  };
};
