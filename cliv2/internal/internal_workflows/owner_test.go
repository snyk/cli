package internal_workflows

import (
	"testing"

	"github.com/snyk/cli-extension-dep-graph/v2/pkg/depgraph"
)

func TestOwnerForFunc(t *testing.T) {
	// Seed moduleOwners so the test does not depend on generated data.
	moduleOwners = []Owner{
		{Module: "github.com/snyk/cli-extension-dep-graph/v2", Owner: "unify"},
	}

	o, ok := OwnerForFunc(depgraph.Init)
	if !ok {
		t.Fatal("expected to resolve owner for depgraph.Init")
	}
	if o.Owner != "unify" {
		t.Fatalf("owner = %q, want %q", o.Owner, "unify")
	}

	if _, ok := OwnerForFunc("not a func"); ok {
		t.Fatal("expected non-func value to resolve to no owner")
	}
}

func TestFuncPkgPath(t *testing.T) {
	got := funcPkgPath(depgraph.Init)
	want := "github.com/snyk/cli-extension-dep-graph/v2/pkg/depgraph"
	if got != want {
		t.Fatalf("funcPkgPath = %q, want %q", got, want)
	}
}
