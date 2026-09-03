package core

import (
	"github.com/snyk/go-application-framework/pkg/contributors"
	"github.com/snyk/go-application-framework/pkg/local_workflows/config_utils"
	"github.com/snyk/go-application-framework/pkg/networking/middleware/contributor_capture"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

const (
	featureFlagEnableEntityContributorsPublish = "enable-entity-contributors-publish"
	configEnableEntityContributorsPublish      = "internal_snyk_contributors_enabled"
)

func initContributorCapture() {
	config_utils.AddFeatureFlagToConfig(globalEngine, configEnableEntityContributorsPublish, featureFlagEnableEntityContributorsPublish)

	if globalConfiguration.GetBool(configEnableEntityContributorsPublish) {
		hook, sink := contributors.NewPostInvokeHook()
		err := workflow.AddPostInvokeHook(globalEngine, hook)
		if err != nil {
			globalEngine.GetNetworkAccess().AddMiddleware(contributor_capture.NewContributorCaptureMiddleware(globalConfiguration, sink, globalLogger))
		}
	}
}
