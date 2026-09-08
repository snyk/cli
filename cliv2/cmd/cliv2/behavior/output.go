package behavior

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/errorcodes"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
)

var toonNumericString = regexp.MustCompile(`^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$`)

type StructuredError struct {
	Ok       bool   `json:"ok"`
	ErrorMsg string `json:"error"`
	Path     string `json:"path"`
}

type OutputFormat string

const (
	outputFormatTOON  OutputFormat = output_workflow.OUTPUT_CONFIG_KEY_TOON
	outputFormatJSON  OutputFormat = output_workflow.OUTPUT_CONFIG_KEY_JSON
	outputFormatSARIF OutputFormat = output_workflow.OUTPUT_CONFIG_KEY_SARIF
	outputFormatHTML  OutputFormat = output_workflow.OUTPUT_CONFIG_KEY_HTML
)

var outputFormats = []OutputFormat{
	outputFormatTOON,
	outputFormatSARIF,
	outputFormatJSON,
	outputFormatHTML,
}

// A format's alternate keys (e.g. sarif accepts json as a fallback for code
// test/secrets test, so the two are interchangeable there) are treated as one
// selection rather than two, so that doesn't get flagged as a conflict.
func ValidateOutputFormatSelection(command string, config configuration.Configuration) error {
	selected := []string{command}
	aliasedAway := map[string]bool{}
	for _, format := range outputFormats {
		key := string(format)
		if aliasedAway[key] || !config.GetBool(key) {
			continue
		}

		selected = append(selected, key)
		if len(selected) > 2 {
			detail := "The following option combination is not currently supported: " + strings.Join(selected, " + ")
			return cli.NewInvalidFlagOptionError(detail)
		}

		for _, alt := range config.GetAlternativeKeys(key) {
			aliasedAway[alt] = true
		}
	}

	return nil
}

func SelectErrorOutputWriter(config configuration.Configuration, stdout, stderr io.Writer) io.Writer {
	if output_workflow.DefaultOutputIsStructured(config) {
		return stderr
	}

	return stdout
}

func StructuredErrorOutputFormat(config configuration.Configuration) (OutputFormat, bool) {
	for _, format := range []OutputFormat{outputFormatTOON, outputFormatJSON} {
		if config.GetBool(string(format)) {
			return format, true
		}
	}

	return "", false
}

func IsDataRenderingError(err error) bool {
	var catalogError snyk_errors.Error
	return errors.As(err, &catalogError) && catalogError.ErrorCode == errorcodes.CLI.DataRenderingError
}

func RenderStructuredError(format OutputFormat, err StructuredError) ([]byte, error) {
	switch format {
	case outputFormatTOON:
		return renderTOONError(err)
	case outputFormatJSON:
		return json.MarshalIndent(err, "", "  ")
	case outputFormatSARIF, outputFormatHTML:
	}

	return nil, fmt.Errorf("unsupported structured error output format: %s", format)
}

func renderTOONError(err StructuredError) ([]byte, error) {
	return fmt.Appendf(
		[]byte{},
		"error: %s\nok: %t\npath: %s",
		formatTOONString(err.ErrorMsg),
		err.Ok,
		formatTOONString(err.Path),
	), nil
}

func formatTOONString(value string) string {
	needsQuotes := value == "" ||
		strings.TrimSpace(value) != value ||
		value == "true" || value == "false" || value == "null" ||
		toonNumericString.MatchString(value) ||
		strings.ContainsAny(value, ":\\\"[]{}") ||
		strings.IndexFunc(value, func(character rune) bool { return character < 0x20 }) >= 0 ||
		strings.HasPrefix(value, "-") ||
		strings.HasPrefix(value, "#")
	if !needsQuotes {
		return value
	}

	var escaped strings.Builder
	escaped.Grow(len(value) + 2)
	escaped.WriteByte('"')
	for _, character := range value {
		switch character {
		case '\\':
			escaped.WriteString(`\\`)
		case '"':
			escaped.WriteString(`\"`)
		case '\n':
			escaped.WriteString(`\n`)
		case '\r':
			escaped.WriteString(`\r`)
		case '\t':
			escaped.WriteString(`\t`)
		default:
			if character < 0x20 {
				escaped.WriteString(fmt.Sprintf(`\u%04x`, character))
			} else {
				escaped.WriteRune(character)
			}
		}
	}
	escaped.WriteByte('"')
	return escaped.String()
}
