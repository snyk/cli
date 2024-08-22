package basic_workflows

import (
	"sync"
	"testing"
	"time"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
)

func Test_(t *testing.T) {
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
