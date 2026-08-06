package basic_workflows

import (
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/local_workflows/content_type"
	"github.com/snyk/go-application-framework/pkg/local_workflows/json_schemas"
	"github.com/snyk/go-application-framework/pkg/local_workflows/local_models"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	clierrors "github.com/snyk/cli/cliv2/internal/errors"
)

func setupMainWorkflowEngine(t *testing.T, config configuration.Configuration, outputFn workflow.Callback) workflow.Engine {
	t.Helper()
	engine := workflow.NewWorkFlowEngine(config)

	workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))

	if outputFn == nil {
		outputFn = func(_ workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
			return input, nil
		}
	}
	_, err := engine.Register(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW, workflowConfig, outputFn)
	require.NoError(t, err)

	require.NoError(t, localworkflows.InitFilterFindingsWorkflow(engine))
	require.NoError(t, InitMainWorkflow(engine))

	return engine
}

func loadJsonFile(t *testing.T, filename string) []byte {
	t.Helper()
	jsonFile, err := os.Open("./testdata/" + filename)
	require.NoError(t, err, "failed to load json")
	defer func(jsonFile *os.File) {
		require.NoError(t, jsonFile.Close())
	}(jsonFile)
	byteValue, err := io.ReadAll(jsonFile)
	require.NoError(t, err)
	return byteValue
}

func Test_mainEntryPoint(t *testing.T) {
	config := configuration.New()
	config.Set(configuration.DEBUG, true)
	engine := setupMainWorkflowEngine(t, config, nil)

	testCmnd := "subcmd1"
	workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))

	fn := func(invocation workflow.InvocationContext, _ []workflow.Data) ([]workflow.Data, error) {
		typeId := workflow.NewTypeIdentifier(invocation.GetWorkflowIdentifier(), "workflowData")
		testSummary := json_schemas.TestSummary{
			Results: []json_schemas.TestSummaryResult{
				{
					Severity: "critical",
					Total:    10,
					Open:     10,
					Ignored:  0,
				},
			},
			Type: "sast",
		}

		d, err := json.Marshal(testSummary)
		require.NoError(t, err)

		data := workflow.NewData(typeId, content_type.TEST_SUMMARY, d)
		return []workflow.Data{data}, nil
	}

	entry, err := engine.Register(workflow.NewWorkflowIdentifier(testCmnd), workflowConfig, fn)
	require.NoError(t, err)
	require.NotNil(t, entry)

	require.NoError(t, localworkflows.InitDataTransformationWorkflow(engine))
	require.NoError(t, engine.Init())

	config.Set(MAIN_WORKFLOW_PARAMETER, testCmnd)
	_, err = engine.Invoke(MAIN_WORKLFOW_ID)

	var expectedError *clierrors.ErrorWithExitCode
	assert.ErrorAs(t, err, &expectedError)
	assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, expectedError.ExitCode)

	actualCode := cliv2.DeriveExitCode(err)
	assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, actualCode)
}

func Test_mainEntryPoint_with_Filtering(t *testing.T) {
	config := configuration.New()
	config.Set(configuration.DEBUG, true)
	config.Set(configuration.IN_MEMORY_THRESHOLD_BYTES, -1)
	config.Set(configuration.FLAG_SEVERITY_THRESHOLD, "high")
	config.Set(configuration.FF_TRANSFORMATION_WORKFLOW, true)

	outputFn := func(_ workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		var findings local_models.LocalFinding
		for i := range input {
			mimeType := input[i].GetContentType()
			if strings.HasPrefix(mimeType, content_type.LOCAL_FINDING_MODEL) {
				findingsBytes := input[i].GetPayload().([]byte)
				err := json.Unmarshal(findingsBytes, &findings)
				assert.NoError(t, err)
			}
		}
		assert.Equal(t, 1, len(findings.Findings))
		return input, nil
	}

	engine := setupMainWorkflowEngine(t, config, outputFn)

	testCmnd := "subcmd1"
	workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))

	fn := func(invocation workflow.InvocationContext, _ []workflow.Data) ([]workflow.Data, error) {
		typeId := workflow.NewTypeIdentifier(invocation.GetWorkflowIdentifier(), "workflowData")
		testSummary := json_schemas.TestSummary{
			Results: []json_schemas.TestSummaryResult{
				{
					Severity: "critical",
					Total:    10,
					Open:     10,
					Ignored:  0,
				},
			},
			Type:             "sast",
			SeverityOrderAsc: []string{"low", "medium", "high", "critical"},
		}

		d, err := json.Marshal(testSummary)
		require.NoError(t, err)

		testSummaryData := workflow.NewData(typeId, content_type.TEST_SUMMARY, d)
		sarifBytes := loadJsonFile(t, "sarif.json")

		localFindings, errTransform := localworkflows.TransformSarifToLocalFindingModel(sarifBytes, d)
		require.NoError(t, errTransform)
		localFindingsBytes, errMarsh := json.Marshal(localFindings)
		require.NoError(t, errMarsh)

		findingsData := workflow.NewData(typeId, content_type.LOCAL_FINDING_MODEL, localFindingsBytes)

		return []workflow.Data{testSummaryData, findingsData}, nil
	}

	entry, err := engine.Register(workflow.NewWorkflowIdentifier(testCmnd), workflowConfig, fn)
	require.NoError(t, err)
	require.NotNil(t, entry)

	require.NoError(t, engine.Init())

	config.Set(MAIN_WORKFLOW_PARAMETER, testCmnd)
	_, _ = engine.Invoke(MAIN_WORKLFOW_ID)
}
