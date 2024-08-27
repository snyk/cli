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

	config := configuration.NewInMemory()
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
	config := configuration.NewInMemory()
	logger := zerolog.New(os.Stderr)
	ca1, err := GetGlobalCertAuthority(config, &logger)
	assert.NoError(t, err)
	assert.FileExists(t, ca1.CertFile)

	// case: manual removal of file
	os.Remove(ca1.CertFile)

	ca2, err := GetGlobalCertAuthority(config, &logger)
	assert.NoError(t, err)
	assert.FileExists(t, ca2.CertFile)
	assert.Equal(t, ca1.CertFile, ca2.CertFile)

	// case: manual removal of file and deletion of cached values
	os.Remove(ca1.CertFile)
	caSingleton.CertPem = ""
	caSingleton.CertFile = ""

	ca3, err := GetGlobalCertAuthority(config, &logger)
	assert.NoError(t, err)
	assert.FileExists(t, ca3.CertFile)
	assert.NotEqual(t, ca1.CertFile, ca3.CertFile)

	// case: use cleanup function
	CleanupGlobalCertAuthority(&logger)

	ca4, err := GetGlobalCertAuthority(config, &logger)
	assert.NoError(t, err)
	assert.FileExists(t, ca4.CertFile)
	assert.NotEqual(t, ca1.CertFile, ca4.CertFile)
}
