package featureflaggateway

// FeatureFlagRequest request body for feature flag request.
type FeatureFlagRequest struct {
	Data FeatureFlagsData `json:"data"`
}

// FeatureFlagsData represents feature flags response data.
type FeatureFlagsData struct {
	Type       string                        `json:"type"`
	Attributes FeatureFlagsRequestAttributes `json:"attributes"`
}

// FeatureFlagsRequestAttributes represents feature flags request attributes.
type FeatureFlagsRequestAttributes struct {
	Flags []string `json:"flags"`
}

// FeatureFlagsResponse represents the updated response format.
type FeatureFlagsResponse struct {
	Data FeatureFlagsDataItem `json:"data"`
}

// FeatureFlagsDataItem represents the "data" object (previously slice).
type FeatureFlagsDataItem struct {
	ID         string                    `json:"id"`
	Type       string                    `json:"type"`
	Attributes FeatureFlagAttributesList `json:"attributes"`
}

// FeatureFlagAttributesList represents attributes containing evaluations + evaluated_at.
type FeatureFlagAttributesList struct {
	Evaluations []FeatureFlagAttributes `json:"evaluations"`
	EvaluatedAt string                  `json:"evaluatedAt"`
}

// FeatureFlagAttributes represent one evaluation result.
type FeatureFlagAttributes struct {
	Key    string `json:"key"`
	Value  bool   `json:"value"`
	Reason string `json:"reason"`
}
