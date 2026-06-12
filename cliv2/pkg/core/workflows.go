package core

import (
	"github.com/snyk/cli-extension-agent-scan/pkg/agentscan"
	"github.com/snyk/cli-extension-ai-bom/pkg/aibom"
	"github.com/snyk/cli-extension-ai-redteam/pkg/redteam"
	"github.com/snyk/cli-extension-dep-graph/v2/pkg/depgraph"
	"github.com/snyk/cli-extension-iac-rules/iacrules"
	"github.com/snyk/cli-extension-iac/pkg/iac"
	"github.com/snyk/cli-extension-os-flows/pkg/osflows"
	"github.com/snyk/cli-extension-sbom/pkg/sbom"
	"github.com/snyk/cli-extension-secrets/pkg/secrets"
	"github.com/snyk/code-client-go/pkg/code"
	"github.com/snyk/container-cli/pkg/container"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/local_workflows/connectivity_check_extension"
	"github.com/snyk/go-application-framework/pkg/local_workflows/ignore_workflow"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/snyk-iac-capture/pkg/capture"
	"github.com/snyk/snyk-ls/ls_extension"
	"github.com/snyk/studio-mcp/pkg/mcp"

	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

func initExtensions(engine workflow.Engine, config configuration.Configuration, additionalExts []workflow.ExtensionInit) {
	engine.AddExtensionInitializer(basic_workflows.Init)
	engine.AddExtensionInitializer(osflows.Init)
	engine.AddExtensionInitializer(iac.Init)
	engine.AddExtensionInitializer(sbom.Init)
	engine.AddExtensionInitializer(aibom.Init)
	engine.AddExtensionInitializer(redteam.Init)
	engine.AddExtensionInitializer(depgraph.Init)
	engine.AddExtensionInitializer(capture.Init)
	engine.AddExtensionInitializer(iacrules.Init)
	engine.AddExtensionInitializer(ls_extension.Init)
	engine.AddExtensionInitializer(mcp.Init)
	engine.AddExtensionInitializer(container.Init)
	engine.AddExtensionInitializer(code.Init)
	engine.AddExtensionInitializer(workflows.InitConnectivityCheckWorkflow)
	engine.AddExtensionInitializer(ignore_workflow.InitIgnoreWorkflows)
	engine.AddExtensionInitializer(agentscan.Init)
	engine.AddExtensionInitializer(secrets.Init)

	// Register additional extensions injected via Run(WithAdditionalExtensions(...))
	for _, ext := range additionalExts {
		engine.AddExtensionInitializer(ext)
	}

	if config.GetBool(configuration.PREVIEW_FEATURES_ENABLED) {
		config.Set("INTERNAL_USE_UFM_PRESENTER", true)
	}
}
