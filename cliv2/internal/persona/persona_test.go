package persona

import (
	"testing"

	"github.com/snyk/go-application-framework/pkg/analytics"
)

// fakeAnalytics records the extension values written by Report. It embeds
// analytics.Analytics (left nil) only to satisfy the full GAF interface; the
// four methods below are the only ones Report ever calls.
type fakeAnalytics struct {
	analytics.Analytics
	ci       bool
	bools    map[string]bool
	integers map[string]int
	strings  map[string]string
}

func newFakeAnalytics() *fakeAnalytics {
	return &fakeAnalytics{
		bools:    map[string]bool{},
		integers: map[string]int{},
		strings:  map[string]string{},
	}
}

func (f *fakeAnalytics) IsCiEnvironment() bool                          { return f.ci }
func (f *fakeAnalytics) AddExtensionBoolValue(key string, value bool)   { f.bools[key] = value }
func (f *fakeAnalytics) AddExtensionIntegerValue(key string, value int) { f.integers[key] = value }
func (f *fakeAnalytics) AddExtensionStringValue(key, value string)      { f.strings[key] = value }

// TestReport verifies that the public entrypoint wires the interactive and
// mode signals onto the analytics instance. The per-mode and per-agent
// behaviour is exercised in the interactive and agent subpackages.
func TestReport(t *testing.T) {
	a := newFakeAnalytics()
	Report(a)

	if _, ok := a.bools[keyInteractive]; !ok {
		t.Fatalf("expected %q to be reported", keyInteractive)
	}
	if _, ok := a.integers[keyInteractiveMode]; !ok {
		t.Fatalf("expected %q to be reported", keyInteractiveMode)
	}
}
