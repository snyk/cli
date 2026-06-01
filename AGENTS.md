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

The authoritative dependency lists live in `go.mod`/`go.sum` (Go) and `package-lock.json` (npm) — read them for exact names and versions rather than trusting any list here. These roles orient you to which dependencies usually matter:

- **Core framework** — `go-application-framework` (GAF): config, networking, workflow engine
- **Language server** — `snyk-ls`
- **Feature logic** — the `cli-extension-*` repos (one per product area); public set registered in `cliv2/pkg/core/workflows.go`, private set in `cliv2-private/`
- **CLIv1 (TypeScript) plugins** — the `snyk-*-plugin` / `@snyk/*` packages

### Investigating an issue (impact assessment)

Method, not memorized data — resolve specifics from source each time:

- **Real versions**: read `go.mod` / `package-lock.json`.
- **Blast radius** (who depends on a package): `go mod why <module>` and `go mod graph` in `cliv2/`; for npm, `npm ls <pkg>`.
- **Pull down a landmark repo**: these are separate GitHub repos — `gh repo clone snyk/<name>` (private ones need `GOPRIVATE` / auth).
- **Where to start, by symptom**: IaC → `cli-extension-iac`; Code/SAST → `code-client-go`; open-source/SCA → `cli-extension-os`; container → `container-cli`; auth/networking → GAF (`pkg/auth`, `pkg/networking`).

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

Keep the first line under 72 characters. This format is enforced on every commit (and, when a branch has more than one commit, on the PR title — it becomes the squash message).

## Pull Request Checks

PR conventions are enforced by **Danger** (`dangerfile.js` is authoritative). To pass first time:

- **Squash to a single commit** before merging — multiple commits are flagged.
- **Commit/PR-title format** must follow [Commit Message Format](#commit-message-format) above (the only *blocking* check).
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
