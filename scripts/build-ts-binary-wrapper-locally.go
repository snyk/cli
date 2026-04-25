package main

import (
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