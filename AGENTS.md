# Agent Instructions for snyk/cli

## Mental Model: The CLI as a Binary Container

This repo builds a **host binary**, not a self-contained application. The Snyk CLI is a Go executable that **composes product features at compile time** by importing extensions from separate repositories. Almost all product/feature logic lives in those external `cli-extension-*` repos — not here.

What **this repo** owns:

- **The Go host process** (`cliv2/`) — startup, Cobra command routing, networking, proxy, analytics, error handling, teardown
- **Extension registration** — `cliv2/pkg/core/workflows.go` is the manifest of all compiled-in extensions
- **The legacy TypeScript CLI** (`src/`) — older commands that haven't migrated to Go workflows yet
- **Build & release infrastructure** — Makefile, CI/CD, signing, packaging

What **this repo does NOT contain**:

- Product logic for `snyk test`, `snyk code test`, `snyk iac test`, `snyk container test`, etc. — these live in extension repos
- The Go Application Framework (GAF) itself — that's `go-application-framework`

**Implication for agents**: If you're investigating a product behavior or bug, the code is almost certainly in an extension repo, not here. See [Extension → Command Mapping](#extension--command-mapping) and [Where Does the Bug Live?](#where-does-the-bug-live) below.

### Command routing

At startup, every registered workflow is turned into a Cobra command dynamically (`createCommandsForWorkflows` in `cliv2/pkg/core/main.go`). When a user runs a command:

1. **Cobra matches** → the command is dispatched to the corresponding Go workflow via `engine.Invoke()`
2. **Cobra can't match** ("unknown command") → the command **falls back to the legacy TypeScript CLI** via `defaultCmd()` → `basic_workflows.WORKFLOWID_LEGACY_CLI`

This fallback is why many commands still work without a Go workflow — they're silently dispatched to the embedded TS binary. A few commands have special wiring (e.g., `code test`, `auth`, `secrets test`) in `cliv2/pkg/core/main.go`.

### Extension → command mapping

The canonical source is `cliv2/pkg/core/workflows.go`. Current mapping:

| User command                        | Extension repo             | Init                                |
| ----------------------------------- | -------------------------- | ----------------------------------- |
| `snyk test`, `snyk monitor`         | `cli-extension-os-flows`   | `osflows.Init`                      |
| `snyk code test`                    | `code-client-go`           | `code.Init`                         |
| `snyk iac test`                     | `cli-extension-iac`        | `iac.Init`                          |
| `snyk iac capture`                  | `snyk-iac-capture`         | `capture.Init`                      |
| `snyk iac rules`                    | `cli-extension-iac-rules`  | `iacrules.Init`                     |
| `snyk container test`               | `container-cli`            | `container.Init`                    |
| `snyk sbom`                         | `cli-extension-sbom`       | `sbom.Init`                         |
| `snyk secrets test`                 | `cli-extension-secrets`    | `secrets.Init`                      |
| `snyk agent-scan` / `snyk mcp-scan` | `cli-extension-agent-scan` | `agentscan.Init`                    |
| `snyk aibom test`                   | `cli-extension-ai-bom`     | `aibom.Init`                        |
| dep-graph                           | `cli-extension-dep-graph`  | `depgraph.Init`                     |
| MCP server                          | `studio-mcp`               | `mcp.Init`                          |
| Language server                     | `snyk-ls`                  | `ls_extension.Init`                 |
| `snyk ignore`                       | GAF built-in               | `ignore_workflow.Init`              |
| Connectivity check                  | GAF built-in               | `connectivity_check_extension.Init` |
| _Unrecognized commands_             | Legacy TS CLI (`src/`)     | Fallback via `defaultCmd()`         |

The private build (`cliv2-private/`) additionally registers `remy-cli-extension` via `WithAdditionalExtensions`.

### Where does the bug live?

- **Product bug** (wrong scan results, missing output fields, incorrect behavior for `snyk test|code|iac|container|sbom`) → **the extension repo** listed above. Clone it, use `go.mod replace` to test locally.
- **CLI plumbing** (auth, proxy, analytics, networking, configuration) → **`cliv2/`** or **`go-application-framework`**.
- **Output formatting** (JSON shape, SARIF, human-readable output) → likely the **output workflow pipeline** in GAF (`local_workflows/output_workflow`), or the extension's content type.
- **Legacy TS command** (commands that fall back to the TypeScript CLI) → **`src/`**.
- **Build/CI issue** → **`.circleci/config.yml`**, **`Makefile`**, or **`cliv2/Makefile`**.

## Before Committing (pre-commit)

Run these before every commit — they mirror CI, which also fails if any tracked file is left uncommitted.

1. **Format**: `make format` (TypeScript + Go, runs `make tidy`)
2. **Lint**: `make lint` (TypeScript + Go)
3. **Verify no drift**: `git diff --name-only` must be empty. Stage anything the steps above changed.

## Before Pushing (pre-push)

1. **Build**: `make build` (add `BUILD_MODE=public` without private-repo access)
2. **Run the tests** — see [Running Tests](#running-tests).

## Setup

macOS with Homebrew:

```sh
./scripts/install-dev-dependencies.sh
npm install
```

## Project Structure

A **hybrid TypeScript + Go** project:

- **`src/`** — TypeScript CLI source (CLIv1, legacy CLI). Manifest `package.json`; resolved-dep source of truth `package-lock.json`
- **`cliv2/`** — Go CLI wrapper (public runtime) that embeds the TypeScript binary. Module `cliv2/go.mod`; public extensions registered in `cliv2/pkg/core/workflows.go`
- **`cliv2-private/`** — private Go runtime; entrypoint adds private extensions (e.g. `github.com/snyk/remy-cli-extension`). Module `cliv2-private/go.mod` may not resolve without private GitHub access / `GOPRIVATE`, but static parsing of `go.mod` still works
- **`packages/`** — npm workspaces (`@snyk/fix`, `@snyk/protect`)
- **`ts-binary-wrapper/`** — npm package that downloads and runs released CLI binaries
- **`release-scripts/`, `scripts/`, `.circleci/`** — release and CI tooling
- **`binary-releases/`** — build output (gitignored)

### Dependency landmarks

The authoritative dependency lists live in `go.mod`/`go.sum` (Go) and `package-lock.json` (npm) — read them for exact names and versions rather than trusting any list here. These roles orient you to which dependencies usually matter:

- **Core framework** — `go-application-framework` (GAF): config, networking, workflow engine
- **Language server** — `snyk-ls`
- **Feature logic** — the `cli-extension-*` repos (one per product area); public set registered in `cliv2/pkg/core/workflows.go`, private set in `cliv2-private/`
- **CLIv1 (TypeScript) plugins** — the `snyk-*-plugin` / `@snyk/*` packages

### Investigating an issue (impact assessment)

First, determine **where the bug lives** — see [Where Does the Bug Live?](#where-does-the-bug-live) and the [Extension → Command Mapping](#extension--command-mapping) table. Most product bugs are in extension repos, not here.

Method, not memorized data — resolve specifics from source each time:

- **Real versions**: read `go.mod` / `package-lock.json`.
- **Blast radius** (who depends on a package): `go mod why <module>` and `go mod graph` in `cliv2/`; for npm, `npm ls <pkg>`.
- **Pull down an extension repo**: these are separate GitHub repos — `gh repo clone snyk/<name>` (private ones need `GOPRIVATE` / auth). Use `go.mod replace` to test local changes against the CLI build.

## Code Style

### TypeScript

- **Prettier** (format) + **ESLint** (lint); tests use **Jest** (`*.spec.ts`)
- Test locations: see [Testing Strategy](#testing-strategy)

### Go (`cliv2/`)

- **gofmt** (format) + **golangci-lint** (lint; version pinned in `cliv2/.golangci.yaml`)
- Standard Go testing (`*_test.go` next to source); mocks generated via `go generate`

## Testing Strategy

The CLI follows a layered testing pyramid. Each layer has a different goal, system under test (SUT), and execution context.

### Unit & Component Tests (Open Box)

- **Goal**: Verify correct implementation of individual functions and components.
- **SUT**: CLI/Plugin/Extension logic (not the built binary).
- **Properties**: Uses mocks to simulate external components. No network calls.
- **Locations**: `test/jest/unit/**/*.spec.ts` (TypeScript), `cliv2/**/*_test.go` (Go).
- **Runs on**: every CLI branch push, and in plugin/extension CI/CD pipelines.

### Integration Tests (Grey Box)

- **Goal**: Verify correct handling of edge cases in component interaction and integration.
- **SUT**: The built CLI binary.
- **Properties**: Uses a fake server (`test/acceptance/fake-server.ts`) to simulate the Snyk API. No real external calls.
- **Locations**: `test/jest/acceptance/**/*.spec.ts` (most files — they use fake-server), `test/tap/*.test.ts` (legacy Tap tests).
- **Runs on**: CLI branch pushes (the `acceptance-tests` CI job, across multiple OS/arch combinations).
- **Note**: Legacy Tap tests (`test/tap/`) exist at this layer. New tests should be Jest (`*.spec.ts`) in `test/jest/acceptance/`.

### User Journey Tests (Grey Box)

- **Goal**: Verify that end-to-end user journeys work and API contracts are met.
- **SUT**: The built CLI binary.
- **Properties**: End-to-end tests against a configurable (real) Snyk instance. Includes contract tests (CLI arguments, JSON output shape) and enforcement testing.
- **Runs on**: plugin/extension CI/CD pipelines and environment testing (on-demand/scheduled). A small number of acceptance tests that use `TEST_SNYK_TOKEN` instead of fake-server belong to this layer.

### System Tests (Closed Box)

- **Goal**: Verify deployment artifacts work correctly across target environments.
- **SUT**: Deployment artifacts (downloaded binaries, not locally built).
- **Properties**: Installs the CLI from the release download URL and runs basic smoke commands (`snyk whoami`, `snyk woof`) on the target platform.
- **Locations**: The `test-release` and `test-release-static` CI jobs in `.circleci/config.yml`.
- **Runs on**: release/deployment branches and `*e2e*` branches. Covers Docker, Alpine, macOS, Windows, Linux (multiple distros), FIPS, and scratch containers.

### Unfocused / Post-Fix Tests (Closed Box)

- **Goal**: Detect regressions for unspecified behavior and implicit contracts with users.
- **SUT**: The CLI binary (preview or release candidate).
- **Properties**: Exploratory and regression testing that is not covered by other layers.
- **Methods**: Snyk-internal preview-release testing ("Snyk for Snyk"), explorative testing, regression testing against multiple open-source projects, canary deployments.
- **Runs on**: on-demand/scheduled, typically before a GA release.

### Which test type should I write?

- **Changing internal logic** (a function, a parser, a formatter) → **unit test** in `test/jest/unit/` or `cliv2/**/*_test.go`.
- **Changing CLI behavior** (command output, flag handling, API interaction) → **integration test** in `test/jest/acceptance/` using fake-server.
- **E2E and system tests** are managed by the CI pipeline and are not typically written by feature contributors.

## Running Tests

```sh
# TypeScript unit tests
npm run test:unit

# TypeScript acceptance tests (requires a built binary)
TEST_SNYK_COMMAND=./binary-releases/snyk-macos-arm64 npm run test:acceptance

# Go tests
cd cliv2 && make test

# A single TS test file
npx jest --runInBand test/jest/unit/path/to/test.spec.ts
```

## Running the CLI Locally

```sh
make build
./binary-releases/snyk-macos-arm64 --version   # adjust for your platform
```

TypeScript-only, without building the full binary:

```sh
npm run dev -- test --all-projects
```

## Build Modes

Auto-detected, but forceable:

```sh
make build BUILD_MODE=public    # OSS-only build (external contributors)
make build BUILD_MODE=private   # full build, requires cliv2-private access
```

**Keep public/private differences explicit.** The public build must not require private-module access — never make `BUILD_MODE=public` depend on `cliv2-private/` or other private repos. When changing dependencies, verify the narrowest affected build/test path and update lockfiles / module files intentionally.

## Commit Message Format

[Conventional Commits](https://www.conventionalcommits.org/): `type: summary`, with an optional body explaining the reasoning.

Types: `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `revert`.
**No breaking changes** — never use `BREAKING CHANGE` or `!`.

Keep the first line under 72 characters. This format is enforced on every commit (and, when a branch has more than one commit, on the PR title — it becomes the squash message).

## Pull Request Checks

PR conventions are enforced by **Danger** (`dangerfile.js` is authoritative). To pass first time:

- **Squash to a single commit** before merging — multiple commits are flagged.
- **Commit/PR-title format** must follow [Commit Message Format](#commit-message-format) above (the only _blocking_ check).
- **Update tests alongside `src/` changes** — touching `src/` with no `test/` change is flagged.
- **New tests go under `test/jest/` as Jest** (`*.spec.ts`); avoid adding Tap-style tests (`*.test.ts`) elsewhere.
- **Use ES6 `import`/`export`** in `.ts` files — not `require()` / `module.exports`.
- **CLI `help/` text** is edited in Gitbook, not here — it syncs in automatically.

## Updating Go Dependencies

```sh
go run ./scripts/upgrade-snyk-go-dependencies.go -name=go-application-framework
make tidy
```

## Building with Local Dependencies

**Go** — add to `cliv2/go.mod`:

```go
replace github.com/snyk/cli-extension-foo => ../../cli-extension-foo
```

**TypeScript** — update `package.json`, then `npm install` and temporarily commit:

```json
"snyk-foo": "file:../snyk-foo",
```

## Architecture

See [Mental Model: The CLI as a Binary Container](#mental-model-the-cli-as-a-binary-container) for the high-level picture of how this repo fits together.

### Binary structure

The shipped CLI is a **Go executable** (`cliv2/`) that embeds the TypeScript CLI binary via `go:embed`. At runtime, registered Go workflows become Cobra commands; unrecognized commands fall back to the embedded TS binary (the `legacycli` workflow), proxying stdin/stdout/stderr and the exit code. See [Command Routing](#command-routing) for details.

### What typically changes in this repo

- **`cliv2/pkg/core/workflows.go`** — add/remove extension registrations
- **`cliv2/go.mod`** — bump extension or GAF versions
- **`cliv2/pkg/core/main.go`** — startup, Cobra wiring, special-case command handlers, error handling
- **`cliv2/internal/`** — proxy, debug logging, constants, help routing
- **`src/`** — legacy TypeScript commands (shrinking as commands migrate to Go workflows)
- **`.circleci/config.yml`**, **`Makefile`** — CI/CD and build pipeline

### Go Application Framework (GAF)

Built on `go-application-framework` (GAF). Commands are **workflows** registered with the engine. Key packages: `pkg/workflow` (engine), `pkg/configuration`, `pkg/networking`, `pkg/auth`, `pkg/local_workflows` (built-ins like auth, whoami).

A workflow receives an `InvocationContext` and input `Data`, and returns output `Data`:

```go
func myWorkflow(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
    config := invocation.GetConfiguration()
    logger := invocation.GetEnhancedLogger()
    // ... do work ...
    return output, nil
}
```

`InvocationContext` exposes `GetConfiguration()`, `GetEnhancedLogger()` (zerolog), `GetNetworkAccess().GetHttpClient()` (auth/proxy-configured), and `GetAnalytics()`.

Registering a workflow is a three-step pattern — define a `WorkflowIdentifier`, write an `Init` that builds a flagset and calls `engine.Register(...)`, and wire it in via `engine.AddExtensionInitializer(...)`. See an existing extension (e.g. `cli-extension-sbom`) for the canonical shape.

### Extensions

Feature logic lives in separate **`cli-extension-*`** repos, registered with GAF at startup via `ExtensionInit`. The full list is in the [Extension → Command Mapping](#extension--command-mapping) table. Suggested layout:

```
extension/
├── init.go       # ExtensionInit + Register + config defaults
├── workflow.go   # Callback (thin shell)
└── domain/       # Business logic, clients, types (no GAF imports)
```

**Key principle**: the workflow callback is a **thin integration shell** — read config/client/context out of `InvocationContext`, hand concrete values to domain code, package the result back into `[]Data`.

**Anti-patterns**:

- ❌ Domain logic inside the callback — extract into domain packages
- ❌ Passing `InvocationContext` into domain code — pass concrete values
- ❌ Deep workflow call chains — keep composition flat
