package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// Colors for output
const (
	red    = "\033[0;31m"
	green  = "\033[0;32m"
	yellow = "\033[1;33m"
	blue   = "\033[0;34m"
	nc     = "\033[0m" // No Color
)

// Configuration
const (
	version    = "1.1298.2"
	platform   = "snyk-macos-arm64"
	sha256Hash = "0a5016d8ec007483fc3397ea06c4f655a3771c3bee34fb778b8bb12c5b19ed9a"
)

// Logging functions
func logInfo(message string) {
	fmt.Printf("%s[INFO]%s %s\n", blue, nc, message)
}

func logSuccess(message string) {
	fmt.Printf("%s[SUCCESS]%s %s\n", green, nc, message)
}

func logWarning(message string) {
	fmt.Printf("%s[WARNING]%s %s\n", yellow, nc, message)
}

func logError(message string) {
	fmt.Printf("%s[ERROR]%s %s\n", red, nc, message)
}

// Get the project root directory
func getProjectRoot() (string, error) {
	// Try to get the script directory first
	scriptDir, err := getScriptDir()
	if err != nil {
		return "", err
	}

	// Check if we're in the scripts directory
	if filepath.Base(scriptDir) == "scripts" {
		return filepath.Dir(scriptDir), nil
	}

	// If not, try to find the project root by looking for key files
	currentDir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current directory: %w", err)
	}

	// Walk up the directory tree to find the project root
	for dir := currentDir; dir != filepath.Dir(dir); dir = filepath.Dir(dir) {
		if fileExists(filepath.Join(dir, "package.json")) &&
			fileExists(filepath.Join(dir, "Makefile")) {
			return dir, nil
		}
	}

	return "", fmt.Errorf("could not find project root (no package.json and Makefile found)")
}

// Get the directory where this script is located
func getScriptDir() (string, error) {
	// If running as source file (go run), use runtime.Caller
	if strings.HasSuffix(os.Args[0], ".go") {
		_, filename, _, ok := runtime.Caller(0)
		if !ok {
			return "", fmt.Errorf("failed to get caller information")
		}
		return filepath.Dir(filename), nil
	}

	// If running as compiled binary, use os.Executable
	executable, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}

	// Resolve symlinks to get the actual path
	resolvedPath, err := filepath.EvalSymlinks(executable)
	if err != nil {
		return "", fmt.Errorf("failed to resolve symlinks: %w", err)
	}

	return filepath.Dir(resolvedPath), nil
}

// Check if a command is available
func isCommandAvailable(command string) bool {
	_, err := exec.LookPath(command)
	return err == nil
}

// Check if a file exists
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// Check if a directory exists
func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// Function to check if required tools are available
func checkRequirements(projectRoot string) error {
	logInfo("Checking requirements...")

	if !isCommandAvailable("npm") {
		return fmt.Errorf("npm is not installed or not in PATH")
	}

	if !isCommandAvailable("make") {
		return fmt.Errorf("make is not installed or not in PATH")
	}

	if !isCommandAvailable("git") {
		return fmt.Errorf("git is not installed or not in PATH")
	}

	if !fileExists(filepath.Join(projectRoot, "package.json")) {
		return fmt.Errorf("package.json not found in project root")
	}

	if !fileExists(filepath.Join(projectRoot, "Makefile")) {
		return fmt.Errorf("Makefile not found in project root")
	}

	logSuccess("All requirements satisfied")
	return nil
}

// Function to validate the project structure
func validateProject(projectRoot string) error {
	logInfo("Validating project structure...")

	if !dirExists(projectRoot) {
		return fmt.Errorf("project root directory not found: %s", projectRoot)
	}

	logSuccess("Project structure validated")
	return nil
}

// Run a command and return error if it fails
func runCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	logInfo(fmt.Sprintf("Running: %s %s", name, strings.Join(args, " ")))

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("command failed: %w", err)
	}

	return nil
}

// Write content to a file
func writeFile(path, content string) error {
	logInfo(fmt.Sprintf("Creating file: %s", path))

	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write file %s: %w", path, err)
	}

	return nil
}

// Create directory if it doesn't exist
func createDir(path string) error {
	logInfo(fmt.Sprintf("Creating directory: %s", path))

	if err := os.MkdirAll(path, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", path, err)
	}

	return nil
}

// Read the "version" field from a package.json / package-lock.json byte slice
func readManifestVersion(data []byte) (string, error) {
	var m struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return "", err
	}
	return m.Version, nil
}

// resetWrapperVersion rolls the ts-binary-wrapper version stamp back to the
// repo's canonical placeholder. `make prepack` runs `npm version <ver>` against
// the wrapper, and a second build then fails with "Version not changed". Unlike
// the root manifests, the wrapper package.json may hold in-progress edits, so we
// must NOT git-checkout it — we only rewrite the single "version" field,
// preserving everything else.
//
// The baseline is the committed *root* version (reliably "1.0.0-monorepo"), not
// the wrapper's own HEAD: a prior build's stamp can get accidentally committed
// into the wrapper manifest, in which case the wrapper's own HEAD is already
// polluted and useless as a reset target.
func resetWrapperVersion(projectRoot string) error {
	wrapperDir := filepath.Join(projectRoot, "ts-binary-wrapper")
	pkgPath := filepath.Join(wrapperDir, "package.json")

	curData, err := os.ReadFile(pkgPath)
	if err != nil {
		return err
	}
	curVer, err := readManifestVersion(curData)
	if err != nil {
		return err
	}

	baseData, err := exec.Command("git", "-C", projectRoot, "show", "HEAD:package.json").Output()
	if err != nil {
		return fmt.Errorf("failed to read committed root version: %w", err)
	}
	baseVer, err := readManifestVersion(baseData)
	if err != nil {
		return err
	}

	if curVer == baseVer {
		return nil // nothing to roll back
	}

	logInfo(fmt.Sprintf("Resetting ts-binary-wrapper version %s -> %s (preserving other edits)", curVer, baseVer))
	oldField := fmt.Sprintf("\"version\": %q", curVer)
	newField := fmt.Sprintf("\"version\": %q", baseVer)
	for _, f := range []string{pkgPath, filepath.Join(wrapperDir, "package-lock.json")} {
		b, err := os.ReadFile(f)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return err
		}
		if err := os.WriteFile(f, []byte(strings.ReplaceAll(string(b), oldField, newField)), 0644); err != nil {
			return err
		}
	}
	return nil
}

// resetPrepackResidue makes the build re-runnable by undoing state a previous
// run may have left behind. Two traps:
//
//  1. `make prepack` is NOT idempotent: it stamps the release version into every
//     manifest and writes a `prepack` marker file, but never rolls back. A second
//     run hits "npm error Version not changed". We can't use `make clean-prepack`
//     because it git-checkouts the ts-binary-wrapper manifests too, discarding any
//     in-progress wrapper edits. So: restore the root + workspace manifests from
//     git (they are pure prepack targets with no hand edits), reset only the
//     wrapper's version field, and remove the marker.
//
//  2. tsconfig.settings.json sets composite:true (incremental builds). A stale
//     tsconfig.tsbuildinfo makes tsc skip emitting, shipping an empty wrapper_dist
//     whose install then fails with "Cannot find module wrapper_dist/bootstrap.js".
//     Clearing it forces a fresh emit.
func resetPrepackResidue(projectRoot string) error {
	markerPath := filepath.Join(projectRoot, "prepack")
	if fileExists(markerPath) {
		logInfo("Detected leftover 'make prepack' state; rolling it back...")

		// Root + workspace manifests are pure prepack targets in this workflow
		// (version stamp + dependency pruning) — restore them from git.
		rootManifests := []string{
			"package.json", "package-lock.json",
			"packages/snyk-fix/package.json", "packages/snyk-fix/package-lock.json",
			"packages/snyk-protect/package.json", "packages/snyk-protect/package-lock.json",
		}
		checkoutArgs := []string{"-C", projectRoot, "checkout", "--"}
		for _, m := range rootManifests {
			if fileExists(filepath.Join(projectRoot, m)) {
				checkoutArgs = append(checkoutArgs, m)
			}
		}
		if err := runCommand("git", checkoutArgs...); err != nil {
			return fmt.Errorf("failed to restore root manifests: %w", err)
		}

		if err := resetWrapperVersion(projectRoot); err != nil {
			return fmt.Errorf("failed to reset wrapper version: %w", err)
		}

		if err := os.Remove(markerPath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to remove prepack marker: %w", err)
		}
	}

	// Always clear the incremental TypeScript build cache so tsc re-emits.
	tsbuildinfo := filepath.Join(projectRoot, "ts-binary-wrapper", "tsconfig.tsbuildinfo")
	if err := os.Remove(tsbuildinfo); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to clear tsconfig.tsbuildinfo: %w", err)
	}

	return nil
}

// Main execution
func main() {
	logInfo("Starting build process...")
	logWarning(fmt.Sprintf("This script assumes %s, please change it if needed!", platform))

	// Get project root
	projectRoot, err := getProjectRoot()
	if err != nil {
		logError(fmt.Sprintf("Failed to get project root: %v", err))
		os.Exit(1)
	}

	logInfo(fmt.Sprintf("Project root determined: %s", projectRoot))

	// Validate environment
	if err := validateProject(projectRoot); err != nil {
		logError(err.Error())
		os.Exit(1)
	}

	if err := checkRequirements(projectRoot); err != nil {
		logError(err.Error())
		os.Exit(1)
	}

	// Change to project root directory
	logInfo(fmt.Sprintf("Changing to project root: %s", projectRoot))
	if err := os.Chdir(projectRoot); err != nil {
		logError(fmt.Sprintf("Failed to change directory: %v", err))
		os.Exit(1)
	}

	// Roll back any leftover state from a previous build so this run is
	// idempotent (prepack version stamps + stale TypeScript build cache).
	logInfo("Resetting build residue from previous runs...")
	if err := resetPrepackResidue(projectRoot); err != nil {
		logError(err.Error())
		os.Exit(1)
	}

	// Install dependencies
	logInfo("Installing npm dependencies...")
	if err := runCommand("npm", "ci"); err != nil {
		logError("Failed to install dependencies")
		os.Exit(1)
	}
	logSuccess("Dependencies installed successfully")

	// Create binary-releases directory
	binaryReleasesDir := "binary-releases"
	if err := createDir(binaryReleasesDir); err != nil {
		logError(err.Error())
		os.Exit(1)
	}

	// Create version file
	versionFile := filepath.Join(binaryReleasesDir, "version")
	if err := writeFile(versionFile, version); err != nil {
		logError(err.Error())
		os.Exit(1)
	}

	// Create SHA256 file
	sha256File := filepath.Join(binaryReleasesDir, platform+".sha256")
	sha256Content := fmt.Sprintf("%s  %s", sha256Hash, platform)
	if err := writeFile(sha256File, sha256Content); err != nil {
		logError(err.Error())
		os.Exit(1)
	}

	// Build the binary
	logInfo("Building binary release...")
	if err := runCommand("make", "binary-releases/snyk.tgz"); err != nil {
		logError("Binary build failed")
		os.Exit(1)
	}
	logSuccess("Binary build completed successfully")
}
