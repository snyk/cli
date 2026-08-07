package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const snykLSModulePath = "github.com/snyk/snyk-ls"

type lsProtocolVersion struct {
	version    int
	commitHash string
	source     string
}

var resolveLSProtocolVersionFromCommit = getLSProtocolVersionFromCommit
var resolveCommitHashFromDir = gitCommitHashFromDir

func getGoreleaserYAML(commit string) (int, error) {
	resolved, err := getLSProtocolVersion()
	if err != nil {
		return -3, err
	}
	return resolved.version, nil
}

func getLSProtocolVersion() (lsProtocolVersion, error) {
	goModPath, err := currentGoModPath()
	if err != nil {
		return lsProtocolVersion{version: -3}, fmt.Errorf("failed to locate go.mod: %w", err)
	}
	if goModPath == "" {
		return lsProtocolVersion{version: -3}, fmt.Errorf("failed to locate go.mod")
	}

	return getLSProtocolVersionWithGoMod(goModPath)
}

func getGoreleaserYAMLWithGoMod(commit string, goModPath string) (int, error) {
	resolved, err := getLSProtocolVersionWithGoMod(goModPath)
	if err != nil {
		return -3, err
	}
	return resolved.version, nil
}

func getLSProtocolVersionWithGoMod(goModPath string) (lsProtocolVersion, error) {
	dependency, err := snykLSDependency(goModPath)
	if err != nil {
		return lsProtocolVersion{version: -3}, err
	}
	if dependency.replacementDir != "" {
		goreleaserPath := filepath.Join(dependency.replacementDir, ".goreleaser.yaml")
		protocolVersion, err := readLSProtocolVersion(goreleaserPath)
		if err != nil {
			return lsProtocolVersion{version: -3}, fmt.Errorf("failed to read LS_PROTOCOL_VERSION from .goreleaser.yaml in replaced snyk-ls path %q: %w", goreleaserPath, err)
		}

		commitHash, err := resolveCommitHashFromDir(dependency.replacementDir)
		if err != nil {
			return lsProtocolVersion{version: -3}, fmt.Errorf("failed to determine commit hash from replaced snyk-ls path %q: %w", dependency.replacementDir, err)
		}
		return lsProtocolVersion{
			version:    protocolVersion,
			commitHash: commitHash,
			source:     fmt.Sprintf(".goreleaser.yaml from replaced snyk-ls path %q", goreleaserPath),
		}, nil
	}

	commitHash, err := commitHashFromModuleVersion(dependency.version)
	if err != nil {
		return lsProtocolVersion{version: -3}, err
	}

	resolved, err := resolveLSProtocolVersionFromCommit(commitHash)
	if err != nil {
		return lsProtocolVersion{version: -3}, err
	}
	if resolved.commitHash == "" {
		resolved.commitHash = commitHash
	}
	return resolved, nil
}

func getGoreleaserYAMLFromCommit(commit string) (int, error) {
	resolved, err := getLSProtocolVersionFromCommit(commit)
	if err != nil {
		return -3, err
	}
	return resolved.version, nil
}

func getLSProtocolVersionFromCommit(commit string) (lsProtocolVersion, error) {
	installOutput, err := exec.Command("go", "install", snykLSModulePath+"@"+commit).CombinedOutput()
	if err != nil {
		return lsProtocolVersion{version: -3}, fmt.Errorf("go install failed: %w: %q", err, string(installOutput))
	}
	modCacheDir, err := goModCache()
	if err != nil {
		return lsProtocolVersion{version: -3}, fmt.Errorf("failed to locate go module cache: %w", err)
	}
	snykLsPkgPaths, err := filepath.Glob(filepath.Join(modCacheDir, "github.com", "snyk", "snyk-ls@v*-"+commit[:12]))
	if err != nil {
		return lsProtocolVersion{version: -3}, fmt.Errorf("failed to match snyk-ls: %w", err)
	}
	if len(snykLsPkgPaths) == 0 {
		return lsProtocolVersion{version: -3}, fmt.Errorf("snyk-ls @ %s not found in module cache; try `go get`?", commit)
	}
	goreleaserPath := filepath.Join(snykLsPkgPaths[0], ".goreleaser.yaml")
	protocolVersion, err := readLSProtocolVersion(goreleaserPath)
	if err != nil {
		return lsProtocolVersion{version: -3}, err
	}
	return lsProtocolVersion{
		version:    protocolVersion,
		commitHash: commit,
		source:     fmt.Sprintf("commit-hash-based resolution from %s@%s", snykLSModulePath, commit),
	}, nil
}

func readLSProtocolVersion(goreleaserPath string) (int, error) {
	goReleaserContents, err := os.ReadFile(goreleaserPath)
	if err != nil {
		return -3, fmt.Errorf("failed to read goreleaser file: %w", err)
	}

	envSection := extractLSProtocolVersion(goReleaserContents)
	if envSection == "" {
		return -1, fmt.Errorf("LS_PROTOCOL_VERSION not found in .goreleaser.yaml")
	}

	protocolVersion, err := strconv.Atoi(envSection)
	if err != nil {
		return -1, fmt.Errorf("failed to parse LS_PROTOCOL_VERSION: %w", err)
	}

	return protocolVersion, nil
}

func currentGoModPath() (string, error) {
	goModPath, ok, err := findGoModFromWorkingDir()
	if err != nil {
		return "", err
	}
	if ok {
		return goModPath, nil
	}

	stdout, err := exec.Command("go", "env", "GOMOD").Output()
	if err != nil {
		return "", err
	}

	goModPath = strings.TrimSpace(string(stdout))
	if goModPath == "" || goModPath == os.DevNull {
		return "", nil
	}
	return goModPath, nil
}

func findGoModFromWorkingDir() (string, bool, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", false, err
	}

	for {
		goModPath := filepath.Join(dir, "go.mod")
		if _, err := os.Stat(goModPath); err == nil {
			return goModPath, true, nil
		} else if !os.IsNotExist(err) {
			return "", false, err
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false, nil
		}
		dir = parent
	}
}

type moduleVersion struct {
	Path    string
	Version string
}

type replaceDirective struct {
	Old moduleVersion
	New moduleVersion
}

type goMod struct {
	Require []moduleVersion
	Replace []replaceDirective
}

type snykLSModule struct {
	version        string
	replacementDir string
}

func parseGoMod(goModPath string) (goMod, error) {
	output, err := exec.Command("go", "mod", "edit", "-json", goModPath).CombinedOutput()
	if err != nil {
		return goMod{}, fmt.Errorf("failed to inspect go.mod: %w: %q", err, string(output))
	}

	var parsed goMod
	if err := json.Unmarshal(output, &parsed); err != nil {
		return goMod{}, fmt.Errorf("failed to parse go.mod: %w", err)
	}

	return parsed, nil
}

func snykLSDependency(goModPath string) (snykLSModule, error) {
	parsed, err := parseGoMod(goModPath)
	if err != nil {
		return snykLSModule{}, err
	}

	var dependency snykLSModule
	for _, required := range parsed.Require {
		if required.Path == snykLSModulePath {
			dependency.version = required.Version
			break
		}
	}
	if dependency.version == "" {
		return snykLSModule{}, fmt.Errorf("%s dependency not found in %s", snykLSModulePath, goModPath)
	}

	for _, replacement := range parsed.Replace {
		if replacement.Old.Path != snykLSModulePath || replacement.New.Version != "" {
			continue
		}

		replacementPath := replacement.New.Path
		if filepath.IsAbs(replacementPath) {
			dependency.replacementDir = filepath.Clean(replacementPath)
			return dependency, nil
		}
		dependency.replacementDir = filepath.Clean(filepath.Join(filepath.Dir(goModPath), replacementPath))
		return dependency, nil
	}

	return dependency, nil
}

func snykLSReplacementDir(goModPath string) (string, bool, error) {
	dependency, err := snykLSDependency(goModPath)
	if err != nil {
		return "", false, err
	}
	if dependency.replacementDir == "" {
		return "", false, nil
	}
	return dependency.replacementDir, true, nil
}

func goModCache() (string, error) {
	stdout, err := exec.Command("go", "env", "GOMODCACHE").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(stdout)), nil
}

func extractLSProtocolVersion(yamlContent []byte) string {
	re := regexp.MustCompile(`(?m)LS_PROTOCOL_VERSION\s*=\s*(\d+)$`)

	matches := re.FindSubmatch(yamlContent)
	if len(matches) > 1 {
		return string(matches[1])
	}
	return ""
}

func commitHashFromModuleVersion(version string) (string, error) {
	parts := strings.Split(version, "-")
	if len(parts) >= 3 {
		return parts[len(parts)-1], nil
	}
	if version != "" {
		return version, nil
	}
	return "", fmt.Errorf("failed to determine snyk-ls commit hash from empty module version")
}

func gitCommitHashFromDir(dir string) (string, error) {
	output, err := exec.Command("git", "-C", dir, "rev-parse", "--short=12", "HEAD").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git rev-parse failed: %w: %q", err, string(output))
	}
	return strings.TrimSpace(string(output)), nil
}

func writeLSProtocolVersionMetadata(version string, outputDir string, commitHashFile string, logWriter io.Writer) (int, error) {
	resolved, err := getLSProtocolVersion()
	if err != nil || resolved.version < 0 {
		return -1, err
	}

	if logWriter != nil {
		fmt.Fprintf(logWriter, "-- Resolved LS protocol version %d using %s\n", resolved.version, resolved.source)
		fmt.Fprintf(logWriter, "-- Resolved LS commit hash %s\n", resolved.commitHash)
	}

	filePath := filepath.Join(outputDir, fmt.Sprintf("ls-protocol-version-%d", resolved.version))
	if err := os.WriteFile(filePath, []byte(version), 0644); err != nil {
		return -1, fmt.Errorf("failed to write to file: %w", err)
	}
	if err := os.WriteFile(commitHashFile, []byte(resolved.commitHash), 0644); err != nil {
		return -1, fmt.Errorf("failed to write commit hash file: %w", err)
	}

	return resolved.version, nil
}

func main() {
	if len(os.Args) != 4 {
		fmt.Println("Usage: go run script.go <version> <output-directory> <commit-hash-output-file>")
		os.Exit(1)
	}

	version := os.Args[1]
	outputDir := os.Args[2]
	commitHashFile := os.Args[3]

	lsProtocolVersion, err := writeLSProtocolVersionMetadata(version, outputDir, commitHashFile, os.Stderr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to retrieve LS_PROTOCOL_VERSION: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(lsProtocolVersion)
	os.Exit(0)
}
