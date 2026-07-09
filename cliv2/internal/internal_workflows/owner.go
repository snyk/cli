package internal_workflows

import (
	"reflect"
	"runtime"
	"strings"
)

// Owner captures the ownership metadata for a Go module, sourced at build time
// from the catalog-info.yaml the module ships in its module zip.
type Owner struct {
	// Module is the Go module path, e.g. "github.com/snyk/cli-extension-sbom".
	Module string
	// Component is the Backstage metadata.name.
	Component string
	// Type is the Backstage spec.type, e.g. "snyk-cli-plugin".
	Type string
	// Owner is the Backstage spec.owner (the owning group/team handle).
	Owner string
	// TeamSlug is the github.com/team-slug annotation, if present.
	TeamSlug string
	// ProjectSlug is the github.com/project-slug annotation, if present.
	ProjectSlug string
}

// moduleOwners is populated by the generated owners_gen.go, which is produced by
// `go generate` and intentionally NOT checked in (see gen.go). When the
// generated file is absent (a plain build without generation) this stays empty
// and every workflow simply falls back to the application owner.
//
//go:generate go run gen.go
var moduleOwners []Owner

// All returns a copy of every known module owner, sorted by module path.
func All() []Owner {
	return append([]Owner(nil), moduleOwners...)
}

// OwnerForModule returns the owner metadata for an exact module path.
func OwnerForModule(modulePath string) (Owner, bool) {
	for _, o := range moduleOwners {
		if o.Module == modulePath {
			return o, true
		}
	}
	return Owner{}, false
}

// OwnerForFunc resolves the owning module of any function value (for example a
// workflow Callback obtained via Entry.GetEntryPoint) by inspecting the
// function's fully-qualified symbol name (its package import path) and matching
// it against the known modules by longest module-path prefix. It returns false
// if the function's package does not belong to any known module.
func OwnerForFunc(fn any) (Owner, bool) {
	pkg := funcPkgPath(fn)
	if pkg == "" {
		return Owner{}, false
	}
	var best Owner
	found := false
	for _, o := range moduleOwners {
		if pkg == o.Module || strings.HasPrefix(pkg, o.Module+"/") {
			if !found || len(o.Module) > len(best.Module) {
				best, found = o, true
			}
		}
	}
	return best, found
}

// funcPkgPath returns the package import path of a function value, e.g.
// "github.com/snyk/cli-extension-sbom/pkg/sbom" for that package's Init.
func funcPkgPath(fn any) string {
	v := reflect.ValueOf(fn)
	if v.Kind() != reflect.Func {
		return ""
	}
	rf := runtime.FuncForPC(v.Pointer())
	if rf == nil {
		return ""
	}
	// name looks like "github.com/snyk/cli-extension-sbom/pkg/sbom.Init".
	// The package path ends at the first '.' after the final '/'.
	name := rf.Name()
	slash := strings.LastIndex(name, "/")
	dot := strings.Index(name[slash+1:], ".")
	if dot < 0 {
		return name
	}
	return name[:slash+1+dot]
}
