package core

import (
	"testing"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/internal_workflows"
)

// TestExtensionOwnershipWorkflowPreviewGate verifies the hidden ownership
// workflow is registered only when preview features are enabled.
func TestExtensionOwnershipWorkflowPreviewGate(t *testing.T) {
	for _, preview := range []bool{false, true} {
		engine := workflow.NewDefaultWorkFlowEngine()
		engine.GetConfiguration().Set(configuration.PREVIEW_FEATURES_ENABLED, preview)
		initExtensions(engine, engine.GetConfiguration(), nil)
		if err := engine.Init(); err != nil {
			t.Fatalf("preview=%v: engine init: %v", preview, err)
		}

		_, registered := engine.GetWorkflow(internal_workflows.WORKFLOWID_EXTENSION_OWNERSHIP)
		if registered != preview {
			t.Fatalf("preview=%v: ownership workflow registered=%v, want %v", preview, registered, preview)
		}
	}
}
