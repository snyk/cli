package basic_workflows

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"sync"

	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/spf13/pflag"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/cli/cliv2/internal/utils"
)

var caSingleton *proxy.CaData
var caMutex sync.Mutex

var WORKFLOWID_GLOBAL_CLEANUP workflow.Identifier = workflow.NewWorkflowIdentifier("internal.cleanup")

const (
	ConfigurationCleanupGlobalCertAuthority = "internal_cleanup_global_cert_auth_enabled"
	ConfigurationCleanupGlobalTempDirectory = "internal_cleanup_global_temp_dir_enabled"
)

func initCleanup(engine workflow.Engine) error {
	engine.GetConfiguration().AddDefaultValue(ConfigurationCleanupGlobalCertAuthority, configuration.StandardDefaultValueFunction(true))
	engine.GetConfiguration().AddDefaultValue(ConfigurationCleanupGlobalTempDirectory, configuration.StandardDefaultValueFunction(true))
	entry, err := engine.Register(WORKFLOWID_GLOBAL_CLEANUP, workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("cleanup", pflag.ContinueOnError)), globalCleanupWorkflow)
	if err != nil {
		return err
	}
	entry.SetVisibility(false)

	return nil
}

func globalCleanupWorkflow(
	invocation workflow.InvocationContext,
	_ []workflow.Data,
) (output []workflow.Data, err error) {
	logger := invocation.GetEnhancedLogger()
	config := invocation.GetConfiguration()

	CleanupGlobalCertAuthority(config, logger)
	CleanupGlobalTempDirectory(config, logger)

	return output, err
}

func CleanupGlobalCertAuthority(config configuration.Configuration, debugLogger *zerolog.Logger) {
	enabled := config.GetBool(ConfigurationCleanupGlobalCertAuthority)
	if !enabled {
		debugLogger.Print("Cleanup of global certificate authority is disabled")
		return
	}

	caMutex.Lock()
	defer caMutex.Unlock()
	if caSingleton != nil {
		err := os.Remove(caSingleton.CertFile)
		if err != nil {
			debugLogger.Print("Failed to delete temporary certificate file: ", caSingleton.CertFile)
			debugLogger.Print(err)
		} else {
			debugLogger.Print("Deleted temporary certificate file: ", caSingleton.CertFile)
		}

		caSingleton = nil
	}
}

func GetGlobalCertAuthority(config configuration.Configuration, debugLogger *zerolog.Logger) (proxy.CaData, error) {
	caMutex.Lock()
	defer caMutex.Unlock()

	createCA := false

	if caSingleton == nil {
		createCA = true
	} else if _, existsError := os.Stat(caSingleton.CertFile); errors.Is(existsError, fs.ErrNotExist) { // certificate file does not exist
		if len(caSingleton.CertPem) > 0 && len(caSingleton.CertFile) > 0 { // try to re-create file
			debugLogger.Printf("Restoring temporary certificate file: %s", caSingleton.CertFile)
			err := utils.WriteToFile(caSingleton.CertFile, caSingleton.CertPem)
			if err != nil {
				debugLogger.Printf("Failed to write cert to file: %s", caSingleton.CertFile)
				return proxy.CaData{}, err
			}
		} else { // fail for this unexpected case
			return proxy.CaData{}, fmt.Errorf("used Certificate Authority is not existing anymore!")
		}
	}

	if createCA {
		debugLogger.Print("Creating new Certificate Authority")
		tmp, err := proxy.InitCA(config, cliv2.GetFullVersion(), debugLogger)
		if err != nil {
			return proxy.CaData{}, err
		}
		caSingleton = tmp
	}

	return *caSingleton, nil
}

func CleanupGlobalTempDirectory(config configuration.Configuration, debugLogger *zerolog.Logger) {
	enabled := config.GetBool(ConfigurationCleanupGlobalTempDirectory)
	if !enabled {
		debugLogger.Print("Cleanup of global temporary directory is disabled")
		return
	}

	tmpDirectory := config.GetString(configuration.TEMP_DIR_PATH)
	err := os.RemoveAll(tmpDirectory)
	if err != nil {
		debugLogger.Print("Failed to delete temporary directory: ", tmpDirectory)
		debugLogger.Print(err)
		return
	}

	debugLogger.Print("Deleted temporary directory: ", tmpDirectory)
}
