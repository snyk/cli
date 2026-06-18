package persona

import "testing"

type fakeAnalytics struct {
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

func (f *fakeAnalytics) AddExtensionBoolValue(key string, value bool)    { f.bools[key] = value }
func (f *fakeAnalytics) AddExtensionIntegerValue(key string, value int)  { f.integers[key] = value }
func (f *fakeAnalytics) AddExtensionStringValue(key, value string)       { f.strings[key] = value }

func TestReport_AlwaysEmitsInteractive(t *testing.T) {
	a := newFakeAnalytics()

	Report(a)

	if _, ok := a.bools[keyInteractive]; !ok {
		t.Fatalf("expected %q to be reported", keyInteractive)
	}
}

func TestReport_AlwaysEmitsInteractiveMode(t *testing.T) {
	a := newFakeAnalytics()

	Report(a)

	if _, ok := a.integers[keyInteractiveMode]; !ok {
		t.Fatalf("expected %q to be reported", keyInteractiveMode)
	}
}

func TestReport_OmitsAgentWhenAbsent(t *testing.T) {
	// The go test runner has no agent signatures set, so the agent key must not
	// be emitted at all rather than emitted empty.
	a := newFakeAnalytics()

	Report(a)

	if v, ok := a.strings[keyAgent]; ok {
		t.Fatalf("expected %q to be omitted, got %q", keyAgent, v)
	}
}
