# Allowed Words Generator

This tool generates a list of allowed words for the CLI's debug log redaction system by scanning the codebase for common words used in log messages.

## Purpose

The CLI redacts potentially sensitive information from debug logs by default. However, this can lead to over-redaction where common log terms are unnecessarily hidden. This generator extracts plain English words from logging statements in the codebase to build an allowlist of terms that should never be redacted.

## How It Works

1. **Scans the CLI codebase** (`cliv2/`) for Go source files
2. **Clones and scans go-application-framework** at the version specified in `cliv2/go.mod`
3. **Extracts string literals** from logging and error function calls
4. **Filters words** to include only:
   - Plain lowercase alphabetic characters
   - Length >= 5 characters (matching `MIN_ARG_LENGTH` in `args.go`)
   - Length <= 20 characters (longer words are likely concatenated identifiers)
   - No repeated characters (e.g., "acccccd" is filtered out)
   - Not in the excluded terms list (programming keywords like "string", "function", etc.)
   - Doesn't match secret patterns (hex strings, UUIDs, etc.)
5. **Generates `allowed_words_generated.go`** with the filtered word list

## Usage

### Automatic (via go generate)

The simplest way to regenerate the allowed words list:

```bash
cd cliv2/internal/utils
go generate
```

This runs the generator and updates `allowed_words_generated.go`.

### Manual

You can also run the generator directly:

```bash
cd cliv2/internal/tools/gen-allowed-words
go run main.go -output ../../utils/allowed_words_generated.go
```

### Options

- `-output <path>` - Output file path (default: stdout)
- `-gaf-path <path>` - Path to a local go-application-framework repo (default: clones to temp dir)

## Testing

The test suite includes a check that verifies the generated file is up-to-date:

```bash
cd cliv2/internal/utils
go test -run Test_AllowedWords_GeneratedFileUpToDate
```

This test:
1. Runs the generator to a temporary file
2. Compares the output with the committed `allowed_words_generated.go`
3. Fails if they differ, indicating the file needs to be regenerated

Use `-short` to skip this test (it requires network access to clone GAF).

## Design Decisions

### Why exclude test files?

Test files often contain nonsensical strings (e.g., "abcdefghijklmnopqrstuvwxyz", "accccccccccccccccccccccccccccx") that would pollute the allowlist with useless terms.

### Why pin to the GAF version in go.mod?

This ensures reproducibility. The generator always extracts words from the same GAF version that the CLI is actually using, so the allowed words match the actual log messages the CLI produces.

### Why lowercase only?

The redaction system converts values to lowercase before checking them, so only lowercase words are relevant.

### Why length >= 5?

This matches `MIN_ARG_LENGTH` in `args.go`. Words shorter than 5 characters are never considered sensitive by the redaction system, so there's no need to allow-list them.

### Why limit to 20 characters?

Very long "words" are usually concatenated identifiers (e.g., "withcachingenabled", "uploadrevisionworkflow") that wouldn't appear naturally in user input. We include them anyway as they're unlikely to be secrets, but we cap at 20 to avoid ridiculous edge cases.

## Security Considerations

The allowed words list is a **tradeoff between usability and security**:

- **Pro**: Reduces false positives where legitimate log context is redacted
- **Con**: If a user happens to use an allowed word as a secret, it won't be redacted

This tradeoff is **acceptable** according to [the CLI redaction RFC](https://snyksec.atlassian.net/wiki/spaces/CLI/pages/3621224687):
> Redaction is input-based plus known patterns, and over-redaction is accepted but should be reduced.

The generator is conservative:
- Only includes words that appear in actual log messages (not arbitrary dictionary words)
- Filters out anything that looks like a token/ID/secret
- Excludes programming terms that wouldn't appear in user messages

## Maintenance

The allowed words list should be regenerated when:
1. Significant new logging is added to the CLI or GAF
2. The GAF dependency is updated to a new version
3. The test `Test_AllowedWords_GeneratedFileUpToDate` fails

The generator is designed to be run as part of the development workflow, not as a CI check, since it requires network access to clone GAF.
