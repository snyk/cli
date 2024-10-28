package basic_workflows

import (
	"os"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
)

func Test_ParallelGetGobalCertAuthority(t *testing.T) {
	var mu sync.Mutex
	caCertFile := ""

	testWorkflow := func(
		invocation workflow.InvocationContext,
		_ []workflow.Data,
	) (output []workflow.Data, err error) {
		config := invocation.GetConfiguration()
		logger := invocation.GetEnhancedLogger()
		ca, err := GetGlobalCertAuthority(config, logger)

		assert.NoError(t, err)
		assert.FileExists(t, ca.CertFile, "Cert file")

		mu.Lock()
		caCertFile = ca.CertFile
		mu.Unlock()

		return output, err
	}

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	engine := workflow.NewWorkFlowEngine(config)
	testWorkflowId := workflow.NewWorkflowIdentifier("internal.test")

	_, err := engine.Register(testWorkflowId, workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("cleanup", pflag.ContinueOnError)), testWorkflow)
	assert.NoError(t, err)

	err = initCleanup(engine)
	assert.NoError(t, err)

	err = engine.Init()
	assert.NoError(t, err)

	count := 10
	stop := make(chan int, count)
	for i := range count {
		go func() {
			_, localErr := engine.Invoke(testWorkflowId)
			assert.NoError(t, localErr)
			stop <- i
		}()
	}

	for range count {
		select {
		case <-stop:
		case <-time.After(time.Second):
			assert.Fail(t, "timeout")
			return
		}
	}

	assert.FileExists(t, caCertFile, "Cert file")

	_, err = engine.Invoke(WORKFLOWID_GLOBAL_CLEANUP)
	assert.NoError(t, err)

	assert.NoFileExists(t, caCertFile, "Cert file")
}

func Test_RestoreCertAuthority(t *testing.T) {
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	// set as we don't call initCleanup()
	config.Set(ConfigurationCleanupGlobalCertAuthority, true)
	logger := zerolog.New(os.Stderr)

	ca1, err := GetGlobalCertAuthority(config, &logger)

	assert.NoError(t, err)
	assert.FileExists(t, ca1.CertFile)

	t.Run("manual removal of file", func(t *testing.T) {
		os.Remove(ca1.CertFile)

		ca2, err := GetGlobalCertAuthority(config, &logger)
		assert.NoError(t, err)
		assert.FileExists(t, ca2.CertFile)
		assert.Equal(t, ca1.CertFile, ca2.CertFile)
	})

	t.Run("manual removal of file and deletion of cached values", func(t *testing.T) {
		os.Remove(ca1.CertFile)
		caSingleton.CertPem = ""
		caSingleton.CertFile = ""

		ca2, err := GetGlobalCertAuthority(config, &logger)
		assert.Error(t, err)
		assert.NotEqual(t, ca1.CertFile, ca2.CertFile)
	})

	t.Run("use cleanup function", func(t *testing.T) {
		CleanupGlobalCertAuthority(config, &logger)

		ca2, err := GetGlobalCertAuthority(config, &logger)
		assert.NoError(t, err)
		assert.FileExists(t, ca2.CertFile)
		assert.NotEqual(t, ca1.CertFile, ca2.CertFile)
	})

	t.Run("skips cleanup function", func(t *testing.T) {
		config.Set(ConfigurationCleanupGlobalCertAuthority, false)
		CleanupGlobalCertAuthority(config, &logger)

		ca2, err := GetGlobalCertAuthority(config, &logger)
		assert.NoError(t, err)
		assert.FileExists(t, ca2.CertFile)
		assert.NotEqual(t, ca1.CertFile, ca2.CertFile)
	})
}
