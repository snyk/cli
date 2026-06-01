# Agent Instructions for snyk/cli

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

Cross-repo dependencies to check first when investigating CLI behavior. Treat `package-lock.json`, `go.mod`, and `go.sum` as the dependency sources of truth — prefer them over memory or hand-maintained lists.

- **CLIv2 core/framework**: `github.com/snyk/go-application-framework`
- **CLIv2 language server**: `github.com/snyk/snyk-ls`
- **CLIv2 extensions**: `github.com/snyk/cli-extension-*`, `github.com/snyk/container-cli`, `github.com/snyk/code-client-go`, `github.com/snyk/studio-mcp`
- **Private CLIv2 extension**: `github.com/snyk/remy-cli-extension` (in `cliv2-private/`)
- **CLIv1 plugin ecosystem**: `snyk-*-plugin`, `@snyk/*-parser`, `@snyk/dep-graph`, `snyk-policy`, `snyk-resolve-deps`

## Code Style

### TypeScript
- **Prettier** (format) + **ESLint** (lint); tests use **Jest** (`*.spec.ts`)
- Unit tests in `test/jest/unit/`, acceptance tests in `test/jest/acceptance/`

### Go (`cliv2/`)
- **gofmt** (format) + **golangci-lint** (lint; version pinned in `cliv2/.golangci.yml`)
- Standard Go testing; mocks generated via `go generate`

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

### Binary structure
The shipped CLI is a **Go executable** (`cliv2/`) that embeds the TypeScript CLI binary via `go:embed`. At runtime the Go CLI decides whether a command is a **native Go workflow** or **legacy TypeScript**; for legacy commands it extracts and spawns the embedded TS binary (the `legacycli` workflow), proxying stdin/stdout/stderr and the exit code.

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
Feature logic lives in separate **`cli-extension-*`** repos, registered with GAF at startup via `ExtensionInit`. Suggested layout:

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
