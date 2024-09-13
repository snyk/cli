package cliv1

import (
	_ "embed"
	"strings"

	"github.com/snyk/cli/cliv2/internal/embedded"
)

// The actual version gets injected at build time
var snykCLIVersion string = "0.0.0"

func CLIV1Version() string {
	return strings.TrimSpace(snykCLIVersion)
}

func ExtractTo(targetFullPath string) error {
	return embedded.ExtractBytesToTarget(snykCLIBytes, targetFullPath)
}
