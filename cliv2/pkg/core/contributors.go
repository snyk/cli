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
		globalEngine.GetNetworkAccess().AddMiddleware(
			contributor_capture.NewContributorCaptureMiddleware(globalConfiguration, sink, globalLogger),
		)
		if err := workflow.AddPostInvokeHook(globalEngine, hook); err != nil {
			globalLogger.Debug().Err(err).Msg("contributors: failed to register post-invoke hook")
		}
	}
}
