package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	minWordLength = 5
	gafModule     = "github.com/snyk/go-application-framework"
)

type wordEntry struct {
	word     string
	isManual bool
}

var (
	// Patterns to identify log/error/format function calls
	logFunctionPatterns = []string{
		"Msg", "Msgf", "Str", "Int", "Bool", "Err",
		"Debug", "Info", "Warn", "Error", "Fatal", "Panic", "Print", "Println",
		"Errorf", "Printf", "Sprintf", "Fprintf",
		"NewError", "New",
	}

	// Pattern to match plain alphabetic words (lowercase only, no numbers or special chars)
	wordPattern = regexp.MustCompile(`\b([a-z]{5,})\b`)

	// Patterns that look like secrets/tokens/IDs to exclude
	secretPatterns = []*regexp.Regexp{
		regexp.MustCompile(`^[a-f0-9]{8,}$`),                                                 // hex strings
		regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`), // UUIDs
		regexp.MustCompile(`\d`),                                                             // contains digits
		regexp.MustCompile(`[A-Z]`),                                                          // contains uppercase (after lowercasing input, shouldn't match)
	}

	// Common programming terms that aren't useful to allow
	excludedTerms = map[string]bool{
		"string":    true,
		"boolean":   true,
		"integer":   true,
		"struct":    true,
		"interface": true,
		"function":  true,
		"return":    true,
		"import":    true,
		"package":   true,
		"const":     true,
		"switch":    true,
		"default":   true,
	}

	output      = flag.String("output", "", "Output file path (default: stdout)")
	gafPath     = flag.String("gaf-path", "", "Path to go-application-framework repo (default: clone to temp dir)")
	manualWords = flag.String("manual-words", "", "Path to manual words file (default: manual-words.txt in same dir as tool)")
)

func main() {
	flag.Parse()

	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	// Load manual words
	manualWordsPath := *manualWords
	if manualWordsPath == "" {
		// Default to manual-words.txt in the same directory as this tool
		manualWordsPath = findManualWordsPath()
	}

	fmt.Fprintf(os.Stderr, "Loading manual words from %s...\n", manualWordsPath)
	manualWordsList, err := loadManualWords(manualWordsPath)
	if err != nil {
		return fmt.Errorf("failed to load manual words: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Loaded %d manual words\n", len(manualWordsList))

	// Determine GAF version from go.mod
	gafVersion, err := getGAFVersion()
	if err != nil {
		return fmt.Errorf("failed to get GAF version: %w", err)
	}

	fmt.Fprintf(os.Stderr, "Using GAF version: %s\n", gafVersion)

	// Get or clone GAF repo
	gafRepoPath := *gafPath
	cleanupGAF := false
	if gafRepoPath == "" {
		gafRepoPath, err = cloneGAFRepo(gafVersion)
		if err != nil {
			return fmt.Errorf("failed to clone GAF repo: %w", err)
		}
		cleanupGAF = true
		defer func() {
			if cleanupGAF {
				os.RemoveAll(gafRepoPath)
			}
		}()
	}

	// Find the CLI repo path (cliv2 directory)
	cliRepoPath, err := findCLIRepoPath()
	if err != nil {
		return fmt.Errorf("failed to find CLI repo: %w", err)
	}

	// Extract words from CLI repo
	fmt.Fprintf(os.Stderr, "Scanning CLI repo at %s...\n", cliRepoPath)
	cliWords, err := extractWordsFromRepo(cliRepoPath)
	if err != nil {
		return fmt.Errorf("failed to extract words from CLI: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Found %d scanned words from CLI\n", len(cliWords))

	// Extract words from GAF repo
	fmt.Fprintf(os.Stderr, "Scanning GAF repo...\n")
	gafWords, err := extractWordsFromRepo(gafRepoPath)
	if err != nil {
		return fmt.Errorf("failed to extract words from GAF: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Found %d scanned words from GAF\n", len(gafWords))

	// Merge scanned words
	scannedWords := mergeWordSets(cliWords, gafWords)

	// Convert manual words list to set for marking
	manualWordsSet := make(map[string]bool, len(manualWordsList))
	for _, word := range manualWordsList {
		manualWordsSet[word] = true
	}

	// Merge all words (manual + scanned)
	allWords := mergeWordSets(manualWordsSet, scannedWords)

	// Create sorted list with manual flag
	entries := make([]wordEntry, 0, len(allWords))
	for word := range allWords {
		entries = append(entries, wordEntry{
			word:     word,
			isManual: manualWordsSet[word],
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].word < entries[j].word
	})

	fmt.Fprintf(os.Stderr, "Total words: %d (%d manual + %d scanned)\n",
		len(allWords), len(manualWordsList), len(allWords)-len(manualWordsList))

	// Generate output
	content := generateGoFile(entries, gafVersion)

	// Write to output
	if *output == "" {
		fmt.Print(content)
	} else {
		if err := os.WriteFile(*output, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to write output: %w", err)
		}
		fmt.Fprintf(os.Stderr, "Generated %s\n", *output)
	}

	return nil
}

func findManualWordsPath() string {
	// Try to find manual-words.txt relative to this tool
	paths := []string{
		"manual-words.txt", // from tool directory
		"../tools/gen-allowed-words/manual-words.txt",             // from internal/utils (via go generate)
		"cliv2/internal/tools/gen-allowed-words/manual-words.txt", // from repo root
	}

	for _, path := range paths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	// Default fallback
	return "manual-words.txt"
}

func loadManualWords(filePath string) ([]string, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(content), "\n")
	words := make([]string, 0)

	for _, line := range lines {
		// Trim whitespace
		line = strings.TrimSpace(line)

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Validate word format (manual words can be any length, but must be lowercase alphabetic)
		if !isValidManualWord(line) {
			return nil, fmt.Errorf("invalid word in manual list: %q (must be lowercase, alphabetic, 1-20 chars)", line)
		}

		words = append(words, line)
	}

	return words, nil
}

func isValidManualWord(word string) bool {
	// Manual words can be any length >= 1, but still have reasonable upper bound
	if len(word) < 1 || len(word) > 20 {
		return false
	}

	// Must be lowercase alphanumeric with underscore (for x86_64, etc.)
	// Manual words are hand-curated so we allow more flexibility
	for _, c := range word {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_') {
			return false
		}
	}

	return true
}

func findCLIRepoPath() (string, error) {
	// Try different relative paths to find the cliv2 directory
	paths := []string{
		"cliv2",     // from repo root
		"../../../", // from internal/tools/gen-allowed-words -> cliv2
		"../../",    // from internal/utils -> cliv2
		".",         // from cliv2
	}

	for _, path := range paths {
		// Check if this path contains typical CLI files
		if _, err := os.Stat(filepath.Join(path, "pkg/core/main.go")); err == nil {
			return path, nil
		}
		// Also check for internal/utils as a marker
		if _, err := os.Stat(filepath.Join(path, "internal/utils/args.go")); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("could not find CLI repo path (cliv2)")
}

func getGAFVersion() (string, error) {
	// Find go.mod by walking up the directory tree
	goModPaths := []string{
		"cliv2/go.mod",    // from repo root
		"../../../go.mod", // from internal/tools/gen-allowed-words
		"../../go.mod",    // from internal/utils (via go generate)
		"go.mod",          // from cliv2
	}

	var goModPath string
	for _, path := range goModPaths {
		if _, err := os.Stat(path); err == nil {
			goModPath = path
			break
		}
	}

	if goModPath == "" {
		return "", fmt.Errorf("could not find cliv2/go.mod in any expected location")
	}

	content, err := os.ReadFile(goModPath)
	if err != nil {
		return "", err
	}

	// Parse go.mod for GAF version
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		if strings.Contains(line, gafModule) {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				return parts[len(parts)-1], nil
			}
		}
	}

	return "", fmt.Errorf("GAF version not found in go.mod")
}

func cloneGAFRepo(version string) (string, error) {
	tempDir, err := os.MkdirTemp("", "gaf-*")
	if err != nil {
		return "", err
	}

	// Clone with depth 1 for specific version/tag
	cmd := exec.Command("git", "clone", "--depth", "1", "--branch", version,
		"https://github.com/snyk/go-application-framework.git", tempDir)
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		// Try without branch if tag doesn't exist
		cmd = exec.Command("git", "clone", "https://github.com/snyk/go-application-framework.git", tempDir)
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			os.RemoveAll(tempDir)
			return "", err
		}

		// Checkout specific version
		cmd = exec.Command("git", "checkout", version)
		cmd.Dir = tempDir
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			os.RemoveAll(tempDir)
			return "", err
		}
	}

	return tempDir, nil
}

func extractWordsFromRepo(repoPath string) (map[string]bool, error) {
	words := make(map[string]bool)

	err := filepath.Walk(repoPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip vendor, test files, and non-Go files
		if info.IsDir() && (info.Name() == "vendor" || info.Name() == ".git") {
			return filepath.SkipDir
		}

		if !strings.HasSuffix(path, ".go") {
			return nil
		}

		// Skip test files
		if strings.HasSuffix(path, "_test.go") {
			return nil
		}

		fileWords, err := extractWordsFromFile(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to parse %s: %v\n", path, err)
			return nil
		}

		for word := range fileWords {
			words[word] = true
		}

		return nil
	})

	return words, err
}

func extractWordsFromFile(filePath string) (map[string]bool, error) {
	words := make(map[string]bool)

	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	// Visit all nodes in the AST
	ast.Inspect(node, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.CallExpr:
			// Check if this is a logging or error function call
			if isLogOrErrorCall(x) {
				extractWordsFromCall(x, words)
			}
		case *ast.BasicLit:
			// Also extract from any string literal (errors, messages, etc.)
			if x.Kind == token.STRING {
				extractWordsFromString(x.Value, words)
			}
		}
		return true
	})

	return words, nil
}

func isLogOrErrorCall(call *ast.CallExpr) bool {
	// Check if the function name matches any log pattern
	funcName := getFunctionName(call.Fun)
	for _, pattern := range logFunctionPatterns {
		if strings.Contains(funcName, pattern) {
			return true
		}
	}
	return false
}

func getFunctionName(expr ast.Expr) string {
	switch x := expr.(type) {
	case *ast.Ident:
		return x.Name
	case *ast.SelectorExpr:
		return x.Sel.Name
	default:
		return ""
	}
}

func extractWordsFromCall(call *ast.CallExpr, words map[string]bool) {
	// Extract words from string literal arguments
	for _, arg := range call.Args {
		if lit, ok := arg.(*ast.BasicLit); ok && lit.Kind == token.STRING {
			extractWordsFromString(lit.Value, words)
		}
	}
}

func extractWordsFromString(s string, words map[string]bool) {
	// Remove quotes
	s = strings.Trim(s, "`\"")

	// Convert to lowercase
	s = strings.ToLower(s)

	// Find all words matching the pattern
	matches := wordPattern.FindAllString(s, -1)
	for _, word := range matches {
		if isValidWord(word) {
			words[word] = true
		}
	}
}

func isValidWord(word string) bool {
	// Check length - too long is likely a concatenated identifier
	if len(word) < minWordLength || len(word) > 20 {
		return false
	}

	// Check if excluded
	if excludedTerms[word] {
		return false
	}

	// Check if it looks like a secret
	for _, pattern := range secretPatterns {
		if pattern.MatchString(word) {
			return false
		}
	}

	// Must be all lowercase letters
	for _, c := range word {
		if c < 'a' || c > 'z' {
			return false
		}
	}

	// Check for too many repeated characters (likely test strings)
	// e.g., "acccccd" or "xxxxxxx"
	maxRepeats := 3
	for i := 0; i < len(word)-maxRepeats; i++ {
		allSame := true
		char := word[i]
		for j := 1; j <= maxRepeats; j++ {
			if word[i+j] != char {
				allSame = false
				break
			}
		}
		if allSame {
			return false
		}
	}

	return true
}

func mergeWordSets(sets ...map[string]bool) map[string]bool {
	result := make(map[string]bool)
	for _, set := range sets {
		for word := range set {
			result[word] = true
		}
	}
	return result
}

func generateGoFile(entries []wordEntry, gafVersion string) string {
	var sb strings.Builder

	sb.WriteString("// Code generated by gen-allowed-words. DO NOT EDIT.\n")
	sb.WriteString("// This file is generated from:\n")
	sb.WriteString("//   - manual-words.txt (hand-curated words)\n")
	sb.WriteString(fmt.Sprintf("//   - CLI repo and go-application-framework %s (scanned from log messages)\n\n", gafVersion))
	sb.WriteString("package utils\n\n")
	sb.WriteString("// allowedWords contains words that should not be redacted from debug logs.\n")
	sb.WriteString("// Words marked (manual) are hand-curated from manual-words.txt.\n")
	sb.WriteString("// Other words are automatically extracted from log and error messages in the codebase.\n")
	sb.WriteString("var allowedWords = map[string]bool{\n")

	// Calculate max word length for alignment
	maxLen := 0
	for _, entry := range entries {
		if len(entry.word) > maxLen {
			maxLen = len(entry.word)
		}
	}

	for _, entry := range entries {
		// Add padding to align colons
		padding := strings.Repeat(" ", maxLen-len(entry.word))
		comment := ""
		if entry.isManual {
			comment = " // manual"
		}
		sb.WriteString(fmt.Sprintf("\t%q:%s true,%s\n", entry.word, padding, comment))
	}

	sb.WriteString("}\n")

	return sb.String()
}
