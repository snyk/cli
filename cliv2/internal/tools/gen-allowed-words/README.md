# Allowed Words Generator

This tool generates the complete allowed words list for the CLI's debug log redaction system by combining hand-curated words with words automatically extracted from the codebase.

## Purpose

The CLI redacts potentially sensitive information from debug logs by default. However, this can lead to over-redaction where common log terms are unnecessarily hidden. This generator creates a comprehensive allowlist from two sources:

1. **Manual words** (`manual-words.txt`) - hand-curated high-value terms
2. **Scanned words** - automatically extracted from log and error messages in the codebase

## How It Works

1. **Loads manual words** from `manual-words.txt` (hand-curated list)
2. **Scans the CLI codebase** (`cliv2/`) for Go source files
3. **Clones and scans go-application-framework** at the version specified in `cliv2/go.mod`
4. **Extracts string literals** from logging and error function calls
5. **Filters scanned words** to include only:
   - Plain lowercase alphabetic characters
   - Length >= 5 characters (matching `MIN_ARG_LENGTH` in `args.go`)
   - Length <= 20 characters (longer words are likely concatenated identifiers)
   - No repeated characters (e.g., "acccccd" is filtered out)
   - Not in the excluded terms list (programming keywords like "string", "function", etc.)
   - Doesn't match secret patterns (hex strings, UUIDs, etc.)
6. **Merges manual and scanned words** into a single list
7. **Generates `allowed_words_generated.go`** with all words, marking manual ones with `// manual` comments

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
- `-manual-words <path>` - Path to manual words file (default: `manual-words.txt` in same directory as tool)

## Manual Words File

The `manual-words.txt` file contains hand-curated words that should always be allowed, regardless of whether they appear in scanned log messages. This file:

- Uses a simple text format: one word per line
- Supports comments (lines starting with `#`)
- Allows empty lines for readability
- Accepts lowercase alphanumeric words with underscores (e.g., `x86_64`)
- Should be kept sorted alphabetically for easy maintenance

Manual words are marked with `// manual` comments in the generated output for transparency.

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

### Why separate manual and scanned words?

Manual words let us include high-value terms that may not appear frequently in log messages, or that have length/format requirements different from scanned words (e.g., "high", "low" are < 5 chars but are valid severity levels). The manual list is also easier to review and audit than thousands of automatically extracted words.

### Why pin to the GAF version in go.mod?

This ensures reproducibility. The generator always extracts words from the same GAF version that the CLI is actually using, so the allowed words match the actual log messages the CLI produces.

### Why lowercase only?

The redaction system converts values to lowercase before checking them, so only lowercase words are relevant.

### Why length >= 5 for scanned words?

This matches `MIN_ARG_LENGTH` in `args.go`. Words shorter than 5 characters are never considered sensitive by the redaction system (unless manually specified), so there's no need to scan for them.

### Why limit to 20 characters?

Very long "words" are usually concatenated identifiers (e.g., "withcachingenabled", "uploadrevisionworkflow") that wouldn't appear naturally in user input. We include them anyway as they're unlikely to be secrets, but we cap at 20 to avoid ridiculous edge cases.

### Why no runtime merge?

Previous versions merged manual and generated words at runtime. The current design generates a single `allowedWords` map to:
- Eliminate runtime overhead
- Make the final list easier to inspect
- Simplify the code (no merge logic in `args.go`)
- Make it obvious which words are manual vs. scanned (via `// manual` comments)

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
1. **Manual words are added/changed** - Edit `manual-words.txt` and run `go generate`
2. **Significant new logging is added** to the CLI or GAF
3. **The GAF dependency is updated** to a new version
4. **The test `Test_AllowedWords_GeneratedFileUpToDate` fails** - indicates the generated file is stale

### Adding New Manual Words

To add a new word to the manual list:

1. Edit `cliv2/internal/tools/gen-allowed-words/manual-words.txt`
2. Add the word in alphabetical order (lowercase, alphanumeric with underscores allowed)
3. Add a comment explaining why if it's not obvious
4. Run `go generate` from `cliv2/internal/utils/`
5. Verify tests pass: `go test ./...`
6. Commit both `manual-words.txt` and `allowed_words_generated.go`

The generator is designed to be run as part of the development workflow, not as a CI check, since it requires network access to clone GAF.
