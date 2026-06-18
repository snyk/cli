package interceptor

// LegacyCLIFeatureFlags is the set of feature flags the embedded legacy
// (TypeScript) CLI checks. Preloading these lets a single batch resolve all of
// them on the first lookup, instead of one network request per flag — which
// matters because the per-user API rate limit is sensitive to request count.
//
// KEEP IN SYNC with src/lib/feature-flags/flags.ts (ALL_TS_FEATURE_FLAGS).
// The drift-guard test (test/jest/unit/lib/feature-flags/flag-registry-sync.spec.ts)
// fails CI if a TypeScript flag is missing from this list.
//
// A flag missing here is not a correctness bug — it simply falls back to its own
// individual lookup — but it silently loses the batching optimization, which is
// what the drift guard protects against.
var LegacyCLIFeatureFlags = []string{
	"show-maven-build-scope",
	"show-npm-scope",
	"cliDotnetRuntimeResolution",
	"enableUvCLI",
	"enableMavenDverboseExhaustiveDeps",
	"includeGoStandardLibraryDeps",
	"disableGoPackageUrlsInCli",
	"scanUsrLibJars",
	"containerCliAppVulnsEnabled",
	"disableContainerMonitorProjectNameFix",
	"allowNewContainerFacts",
	"iacNewEngine",
	"iacIntegratedExperience",
	"iacShareCliResultsCustomRules",
	"iacCliShareResults",
	"cliSnykFix",
}
