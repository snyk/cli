package behavior

import (
	"bytes"
	"io"
	"os"
	"testing"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStructuredErrorOutputFormat(t *testing.T) {
	for _, testCase := range []struct {
		format   OutputFormat
		selected bool
	}{
		{format: outputFormatJSON, selected: true},
		{format: outputFormatTOON, selected: true},
		{format: OutputFormat(output_workflow.OUTPUT_CONFIG_KEY_SARIF), selected: false},
		{format: OutputFormat(output_workflow.OUTPUT_CONFIG_KEY_HTML), selected: false},
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
		{name: "sarif alone", selected: []OutputFormat{OutputFormat(output_workflow.OUTPUT_CONFIG_KEY_SARIF)}, wantStderr: true},
		{name: "html alone", selected: []OutputFormat{OutputFormat(output_workflow.OUTPUT_CONFIG_KEY_HTML)}, wantStderr: true},
		{name: "sarif and json", selected: []OutputFormat{OutputFormat(output_workflow.OUTPUT_CONFIG_KEY_SARIF), outputFormatJSON}, wantStderr: true},
		{name: "sarif and html", selected: []OutputFormat{OutputFormat(output_workflow.OUTPUT_CONFIG_KEY_SARIF), OutputFormat(output_workflow.OUTPUT_CONFIG_KEY_HTML)}, wantStderr: true},
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
