package behavior

import (
	"bytes"
	"io"
	"os"
	"testing"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOutputFormatSelection(t *testing.T) {
	formats := []OutputFormat{
		outputFormatTOON,
		outputFormatSARIF,
		outputFormatJSON,
		outputFormatHTML,
	}

	for _, format := range formats {
		t.Run("allows "+string(format)+" by itself", func(t *testing.T) {
			config := outputConfig(format)

			assert.NoError(t, ValidateOutputFormatSelection("test", config))
		})
	}

	for index, first := range formats {
		for _, second := range formats[index+1:] {
			if (first == outputFormatSARIF && second == outputFormatJSON) ||
				(first == outputFormatJSON && second == outputFormatSARIF) {
				t.Run("allows "+string(first)+" with "+string(second), func(t *testing.T) {
					config := outputConfig(first, second)

					assert.NoError(t, ValidateOutputFormatSelection("test", config))
				})
				continue
			}

			t.Run("rejects "+string(first)+" with "+string(second), func(t *testing.T) {
				config := outputConfig(first, second)

				err := ValidateOutputFormatSelection("test", config)
				require.Error(t, err)
				var catalogError snyk_errors.Error
				require.ErrorAs(t, err, &catalogError)
				assert.Equal(t, "SNYK-CLI-0004", catalogError.ErrorCode)
				assert.Equal(
					t,
					"The following option combination is not currently supported: test + "+string(first)+" + "+string(second),
					catalogError.Detail,
				)
			})
		}
	}
}

func TestValidateOutputFormatSelection_ConfigFileConflict(t *testing.T) {
	// A CLI-1828 regression case: nothing on the command line changed the flags,
	// but the resolved config still carries both formats (e.g. from a config
	// file or env var), so the conflict must still be caught.
	config := configuration.NewWithOpts()
	config.Set(string(outputFormatTOON), true)
	config.Set(string(outputFormatJSON), true)

	err := ValidateOutputFormatSelection("test", config)

	require.Error(t, err)
	var catalogError snyk_errors.Error
	require.ErrorAs(t, err, &catalogError)
	assert.Equal(t, "SNYK-CLI-0004", catalogError.ErrorCode)
}

func TestValidateOutputFormatSelection_RejectsConfigConflict(t *testing.T) {
	// Exact repro from the CLI-1828 review: no flag was ever Changed, but the
	// config file alone enables two conflicting formats.
	t.Chdir(t.TempDir())
	require.NoError(t, os.WriteFile(
		"output-conflict.json",
		[]byte(`{"toon":true,"json":true}`),
		0o600,
	))
	config := configuration.NewWithOpts(configuration.WithFiles("output-conflict"))
	require.True(t, config.GetBool(string(outputFormatTOON)))
	require.True(t, config.GetBool(string(outputFormatJSON)))

	err := ValidateOutputFormatSelection("test", config)

	require.Error(t, err, "toon and json from config must conflict")
}

func TestValidateOutputFormatSelection_AllowsSarifAndJSONForAnyCommand(t *testing.T) {
	// Preserves behavior (before --toon/--html existed) for every
	// command, not just code test/secrets test's explicit aliasing.
	config := configuration.NewWithOpts()
	config.Set(string(outputFormatSARIF), true)
	config.Set(string(outputFormatJSON), true)

	assert.NoError(t, ValidateOutputFormatSelection("iac test", config))
}

func TestValidateOutputFormatSelection_AllowsAliasedFormats(t *testing.T) {
	// code test/secrets test register sarif and json as interchangeable via
	// AddAlternativeKeys; that pair must not be flagged as a conflict.
	config := configuration.NewWithOpts()
	config.AddAlternativeKeys(string(outputFormatSARIF), []string{string(outputFormatJSON)})
	config.Set(string(outputFormatJSON), true)

	assert.NoError(t, ValidateOutputFormatSelection("code test", config))
}

func TestValidateOutputFormatSelection_IgnoresFileOutputFlags(t *testing.T) {
	// *-file-output flags write to a file, not stdout, so they never compete
	// with a console format or each other.
	config := configuration.NewWithOpts()
	config.Set(string(outputFormatHTML), true)
	config.Set(output_workflow.OUTPUT_CONFIG_KEY_JSON_FILE, true)
	config.Set(output_workflow.OUTPUT_CONFIG_KEY_SARIF_FILE, true)
	config.Set(output_workflow.OUTPUT_CONFIG_KEY_TOON_FILE, true)

	assert.NoError(t, ValidateOutputFormatSelection("test", config))
}

func outputConfig(selected ...OutputFormat) configuration.Configuration {
	config := configuration.NewWithOpts()
	for _, format := range selected {
		config.Set(string(format), true)
	}
	return config
}

func TestStructuredErrorOutputFormat(t *testing.T) {
	for _, testCase := range []struct {
		format   OutputFormat
		selected bool
	}{
		{format: outputFormatJSON, selected: true},
		{format: outputFormatTOON, selected: true},
		{format: outputFormatSARIF, selected: false},
		{format: outputFormatHTML, selected: false},
	} {
		t.Run(string(testCase.format), func(t *testing.T) {
			config := configuration.NewWithOpts()
			config.Set(string(testCase.format), true)

			actual, selected := StructuredErrorOutputFormat(config)

			assert.Equal(t, testCase.selected, selected)
			if selected {
				assert.Equal(t, testCase.format, actual)
			}
		})
	}
}

func TestSelectErrorOutputWriter(t *testing.T) {
	for _, testCase := range []struct {
		name       string
		selected   []OutputFormat
		wantStderr bool
	}{
		{name: "no format selected (legacy human output)", selected: nil, wantStderr: false},
		{name: "json alone", selected: []OutputFormat{outputFormatJSON}, wantStderr: true},
		{name: "toon alone", selected: []OutputFormat{outputFormatTOON}, wantStderr: true},
		{name: "sarif alone", selected: []OutputFormat{outputFormatSARIF}, wantStderr: true},
		{name: "html alone", selected: []OutputFormat{outputFormatHTML}, wantStderr: true},
		{name: "sarif and json", selected: []OutputFormat{outputFormatSARIF, outputFormatJSON}, wantStderr: true},
		{name: "sarif and html", selected: []OutputFormat{outputFormatSARIF, outputFormatHTML}, wantStderr: true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			config := configuration.NewWithOpts()
			for _, format := range testCase.selected {
				config.Set(string(format), true)
			}
			stdout := &bytes.Buffer{}
			stderr := &bytes.Buffer{}

			writer := SelectErrorOutputWriter(config, stdout, stderr)

			if testCase.wantStderr {
				assert.Same(t, io.Writer(stderr), writer)
			} else {
				assert.Same(t, io.Writer(stdout), writer)
			}
		})
	}
}

func TestRenderStructuredError_matchesApprovedToonFixture(t *testing.T) {
	expected, err := os.ReadFile("testdata/error.toon")
	require.NoError(t, err)
	expected = bytes.TrimSuffix(expected, []byte("\n"))

	actual, err := RenderStructuredError(outputFormatTOON, StructuredError{
		Ok:       false,
		ErrorMsg: "No supported files found",
		Path:     "/workspace",
	})

	require.NoError(t, err)
	assert.Equal(t, string(expected), string(actual))
}

func TestRenderStructuredError_quotesToonStrings(t *testing.T) {
	tests := []struct {
		name     string
		input    StructuredError
		expected string
	}{
		{
			name: "TOON syntax and whitespace",
			input: StructuredError{
				Ok:       false,
				ErrorMsg: "scan: failed\nretry",
				Path:     " /workspace ",
			},
			expected: "error: \"scan: failed\\nretry\"\npath: \" /workspace \"",
		},
		{
			name: "control characters",
			input: StructuredError{
				Ok:       false,
				ErrorMsg: "invalid\x01detail",
			},
			expected: "error: \"invalid\\u0001detail\"\npath: \"\"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := RenderStructuredError(outputFormatTOON, test.input)

			require.NoError(t, err)
			assert.Equal(t, test.expected, string(actual))
		})
	}
}

func TestRenderStructuredError_keepsSafeToonStringsUnquoted(t *testing.T) {
	actual, err := RenderStructuredError(outputFormatTOON, StructuredError{
		Ok:       false,
		ErrorMsg: "scan failed, retry",
		Path:     `\\server\share`,
	})

	require.NoError(t, err)
	assert.Equal(t, "error: scan failed, retry\npath: \"\\\\\\\\server\\\\share\"", string(actual))

	actual, err = RenderStructuredError(outputFormatTOON, StructuredError{
		Ok:       false,
		ErrorMsg: "true",
		Path:     "#comment",
	})

	require.NoError(t, err)
	assert.Equal(t, "error: \"true\"\npath: \"#comment\"", string(actual))
}
