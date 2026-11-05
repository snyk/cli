package core

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/snyk/go-application-framework/pkg/instrumentation"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/constants"
)

// lifecycleCommands are served by the install and uninstall workflows of GAF. They must not fall back to the legacy CLI.
var lifecycleCommands = []string{"install", "uninstall"}

// runWithArgs runs the CLI in process with the given arguments. The run is isolated from the configuration of the
// developer and from analytics.
func runWithArgs(t *testing.T, args ...string) (*cliRun, int) {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	t.Setenv("SNYK_DISABLE_ANALYTICS", "1")

	oldArgs := append([]string{}, os.Args...)
	os.Args = append([]string{"snyk"}, args...)
	defer func() { os.Args = oldArgs }()

	return execute(nil)
}

// Test_lifecycleCommands_areRegisteredWorkflows: install and uninstall are workflows of the engine, not unknown commands
// that the Cobra routing hands to the legacy CLI.
func Test_lifecycleCommands_areRegisteredWorkflows(t *testing.T) {
	r, _ := runWithArgs(t, "--help")

	for _, command := range lifecycleCommands {
		_, ok := r.engine.GetWorkflow(workflow.NewWorkflowIdentifier(command))
		assert.True(t, ok, "%s is registered as a workflow", command)
	}
}

// Test_lifecycleCommands_areKnownCommandsInAnalytics: the analytics category of a run names install or uninstall.
func Test_lifecycleCommands_areKnownCommandsInAnalytics(t *testing.T) {
	r, _ := runWithArgs(t, "--help")

	for _, command := range lifecycleCommands {
		assert.Equal(t, []string{command}, instrumentation.DetermineCategory([]string{"snyk", command}, r.engine))
	}
}

// Test_lifecycleCommands_withoutStepsSucceed: with no lifecycle steps registered, both commands succeed. Today the
// unknown command falls back to the legacy CLI, which does not run in this test.
func Test_lifecycleCommands_withoutStepsSucceed(t *testing.T) {
	for _, command := range lifecycleCommands {
		t.Run(command, func(t *testing.T) {
			_, exitCode := runWithArgs(t, command)

			assert.Equal(t, constants.SNYK_EXIT_CODE_OK, exitCode)
		})
	}
}
