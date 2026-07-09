// Package internal_workflows hosts hidden, internal-only workflows that are not
// part of the public CLI surface.
package internal_workflows

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/spf13/pflag"

	"github.com/snyk/go-application-framework/pkg/workflow"
)

// WORKFLOWID_EXTENSION_OWNERSHIP identifies the hidden workflow that dumps the
// ownership of every registered workflow as JSON. It is intended for the
// analytics-service (and CI), which owns the higher-level event -> owning-team
// mapping and applies its own fallback logic; the CLI only reports raw facts.
var WORKFLOWID_EXTENSION_OWNERSHIP = workflow.NewWorkflowIdentifier("internal.extension-ownership")

// workflowOwnership is the raw, per-workflow fact reported by the dump: which
// module registered the workflow and, where known, that module's owner.
type workflowOwnership struct {
	WorkflowID  string `json:"workflowId"`
	Command     string `json:"command"`
	Module      string `json:"module,omitempty"`
	Owner       string `json:"owner,omitempty"`
	TeamSlug    string `json:"teamSlug,omitempty"`
	ProjectSlug string `json:"projectSlug,omitempty"`
}

// ownershipReport is the payload emitted by the hidden workflow. Modules is the
// build-time catalog-info.yaml snapshot; Workflows is the per-workflow ownership
// derived from the live engine registry.
type ownershipReport struct {
	Modules   []Owner             `json:"modules"`
	Workflows []workflowOwnership `json:"workflows"`
}

// InitExtensionOwnershipWorkflow registers the hidden extension-ownership
// workflow. It is wired in only for preview builds (see pkg/core/workflows.go).
func InitExtensionOwnershipWorkflow(engine workflow.Engine) error {
	flags := pflag.NewFlagSet("extension-ownership", pflag.ContinueOnError)
	entry, err := engine.Register(
		WORKFLOWID_EXTENSION_OWNERSHIP,
		workflow.ConfigurationOptionsFromFlagset(flags),
		extensionOwnershipEntryPoint,
	)
	if err != nil {
		return err
	}
	entry.SetVisibility(false)
	return nil
}

func extensionOwnershipEntryPoint(invocation workflow.InvocationContext, _ []workflow.Data) ([]workflow.Data, error) {
	report := buildOwnershipReport(invocation.GetEngine())

	payload, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ownership report: %w", err)
	}

	data := workflow.NewData(
		workflow.NewTypeIdentifier(WORKFLOWID_EXTENSION_OWNERSHIP, "extension-ownership"),
		"application/json",
		payload,
		workflow.WithConfiguration(invocation.GetConfiguration()),
		workflow.WithLogger(invocation.GetEnhancedLogger()),
	)
	return []workflow.Data{data}, nil
}

// buildOwnershipReport reads every registered workflow from the engine and
// attributes it to the module that owns its entry point. The workflow's callback
// (Entry.GetEntryPoint) lives in the registering extension's package, so its
// import path resolves to the module whose catalog-info.yaml supplies the owner.
func buildOwnershipReport(engine workflow.Engine) ownershipReport {
	ids := engine.GetWorkflows()
	workflows := make([]workflowOwnership, 0, len(ids))

	for _, id := range ids {
		entry, ok := engine.GetWorkflow(id)
		if !ok {
			continue
		}

		w := workflowOwnership{
			WorkflowID: id.String(),
			Command:    workflow.GetCommandFromWorkflowIdentifier(id),
		}
		if owner, found := OwnerForFunc(entry.GetEntryPoint()); found {
			w.Module = owner.Module
			w.Owner = owner.Owner
			w.TeamSlug = owner.TeamSlug
			w.ProjectSlug = owner.ProjectSlug
		}
		workflows = append(workflows, w)
	}

	sort.Slice(workflows, func(i, j int) bool { return workflows[i].WorkflowID < workflows[j].WorkflowID })
	return ownershipReport{Modules: All(), Workflows: workflows}
}
