package core

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"testing"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/stretchr/testify/require"
)

type registeredCommandForHelpAudit struct {
	Command string `json:"command"`
	Visible bool   `json:"visible"`
}

func TestPrintRegisteredCommandTreeForHelpAudit(t *testing.T) {
	if os.Getenv("SNYK_HELP_AUDIT_PRINT_COMMANDS") != "1" {
		t.Skip("set SNYK_HELP_AUDIT_PRINT_COMMANDS=1 to print registered commands")
	}

	config := configuration.New()
	engine := workflow.NewWorkFlowEngine(config)
	initExtensions(engine, config, nil)
	require.NoError(t, engine.Init())

	commands := []registeredCommandForHelpAudit{}
	for _, workflowID := range engine.GetWorkflows() {
		command := workflow.GetCommandFromWorkflowIdentifier(workflowID)
		if command == "" {
			continue
		}

		entry, ok := engine.GetWorkflow(workflowID)
		if !ok {
			continue
		}

		commands = append(commands, registeredCommandForHelpAudit{
			Command: command,
			Visible: entry.IsVisible(),
		})
	}

	sort.Slice(commands, func(i, j int) bool {
		return commands[i].Command < commands[j].Command
	})

	output, err := json.Marshal(commands)
	require.NoError(t, err)

	fmt.Printf("SNYK_HELP_AUDIT_COMMANDS=%s\n", output)
}
