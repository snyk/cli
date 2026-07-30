package basic_workflows

import (
	"context"
	"strings"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/contributorbilling"
	"github.com/snyk/go-application-framework/pkg/networking/contributorcapture"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

func defaultRepoPath(workingDirectory string) string {
	if strings.TrimSpace(workingDirectory) == "" {
		return "."
	}
	return workingDirectory
}

func contributorBillingAuthHeader(config configuration.Configuration) string {
	if token := strings.TrimSpace(config.GetString(configuration.AUTHENTICATION_TOKEN)); token != "" {
		return "token " + token
	}
	if bearer := strings.TrimSpace(config.GetString(configuration.AUTHENTICATION_BEARER_TOKEN)); bearer != "" {
		return "Bearer " + bearer
	}
	return ""
}

func billingCapability(capability contributorcapture.Capability) string {
	switch capability {
	case contributorcapture.CapabilityOSS:
		return contributorbilling.CapabilityOSS
	case contributorcapture.CapabilityIaC:
		return contributorbilling.CapabilityIaC
	case contributorcapture.CapabilityCode:
		return contributorbilling.CapabilityCode
	default:
		return ""
	}
}

// emitLegacyContributorBilling posts contributor billing for project IDs captured during a
// legacy CLI invocation. It is fire-and-forget and must not affect command exit codes.
//
// TODO(IANDT-238): delegate to contributorcapture.EmitCapturedRecords once GAF wires HTTP
// client fields on EmitOptions (depends on IANDT-237 + IANDT-238 landing).
func emitLegacyContributorBilling(
	ctx context.Context,
	invocation workflow.InvocationContext,
	capture *contributorcapture.Capture,
	workingDirectory string,
) {
	if capture == nil {
		return
	}

	records := capture.Snapshot()
	if len(records) == 0 {
		return
	}

	config := invocation.GetConfiguration()
	scopeID := strings.TrimSpace(config.GetString(configuration.ORGANIZATION))
	if scopeID == "" {
		return
	}

	repoPath := defaultRepoPath(workingDirectory)
	logger := invocation.GetEnhancedLogger()
	httpClient := invocation.GetNetworkAccess().GetHttpClient()
	ingestURL := config.GetString(configuration.API_URL)
	authHeader := contributorBillingAuthHeader(config)

	type emitKey struct {
		capability string
		projectID  string
	}
	seen := make(map[emitKey]struct{}, len(records))

	for _, record := range records {
		capability := billingCapability(record.Capability)
		projectID := strings.TrimSpace(record.ProjectID)
		if capability == "" || projectID == "" {
			continue
		}

		key := emitKey{capability: capability, projectID: projectID}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		contributorbilling.EmitContributorBilling(ctx, contributorbilling.EmitOptions{
			HTTPClient:          httpClient,
			IngestURL:           ingestURL,
			AuthHeader:          authHeader,
			Capability:          capability,
			ScopeID:             scopeID,
			RepoPath:            repoPath,
			CollectContributors: true,
			Timeout:             contributorbilling.DefaultTimeout,
			Logger:              logger,
			Items: []contributorbilling.BillingItem{
				{EntityID: projectID},
			},
		})
	}
}
