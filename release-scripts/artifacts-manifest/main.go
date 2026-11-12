// Command artifacts-manifest fills in the artifacts manifest template, checks it against the build
// output and writes artifacts-manifest.json there. Run from release-scripts/:
//
//	go run ./artifacts-manifest --version <version> --commit <commit> --channel <channel> <build output dir>
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "artifacts-manifest:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	const usage = "usage: artifacts-manifest --version <version> --commit <commit> --channel <channel> <build output dir>"

	flags := flag.NewFlagSet("artifacts-manifest", flag.ContinueOnError)
	version := flags.String("version", "", "CLI version being released")
	commit := flags.String("commit", "", "git commit the release was built from")
	channel := flags.String("channel", "", "release channel")
	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%w\n%s", err, usage)
	}
	if flags.NArg() != 1 {
		return errors.New(usage)
	}
	dir := flags.Arg(0)

	template, err := os.ReadFile(manifestName)
	if err != nil {
		return err
	}
	manifest, err := Build(template, dir, *version, *commit, *channel)
	if err != nil {
		return err
	}

	encoded, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, manifestName), append(encoded, '\n'), 0o644)
}

const (
	schemaVersion = 1
	targetS3      = "s3"
	targetGitHub  = "github"
	targetNPM     = "npm"

	channelDev    = "dev"
	channelStable = "stable"

	manifestName = "artifacts-manifest.json"
)

var placeholderPattern = regexp.MustCompile(`\$[A-Za-z_][A-Za-z0-9_]*`)

type Manifest struct {
	SchemaVersion int        `json:"schemaVersion"`
	Meta          Meta       `json:"meta"`
	Artifacts     []Artifact `json:"artifacts"`
}

type Meta struct {
	Version        string `json:"version"`
	Commit         string `json:"commit"`
	ReleaseChannel string `json:"releaseChannel"`
}

type Artifact struct {
	// Name is a path relative to the build output directory, like ./fips/snyk-linux.
	Name    string   `json:"name"`
	SHA256  string   `json:"sha256"`
	Targets []Target `json:"targets"`
}

type Target struct {
	Type string `json:"type"`
	Path string `json:"path,omitempty"`
}

func Build(template []byte, dir, version, commit, channel string) (*Manifest, error) {
	if version == "" || commit == "" || channel == "" {
		return nil, errors.New("version, commit and channel are required")
	}

	var m Manifest
	decoder := json.NewDecoder(bytes.NewReader(template))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&m); err != nil {
		return nil, fmt.Errorf("parsing template: %w", err)
	}
	if m.SchemaVersion != schemaVersion {
		return nil, fmt.Errorf("unsupported schemaVersion %d, expected %d", m.SchemaVersion, schemaVersion)
	}

	var problems []string
	m.Meta = Meta{Version: version, Commit: commit, ReleaseChannel: channel}
	replacer := strings.NewReplacer("$VERSION", version, "$COMMIT", commit, "$CHANNEL", channel)

	var artifacts []Artifact
	seen := map[string]bool{}
	for _, a := range m.Artifacts {
		a.Name = replacer.Replace(a.Name)
		a.Targets = fillTargets(a.Targets, replacer, channel)

		name, err := cleanPath(a.Name)
		if err != nil {
			problems = append(problems, err.Error())
			continue
		}
		if seen[name] {
			problems = append(problems, fmt.Sprintf("%s is declared more than once", name))
			continue
		}
		seen[name] = true
		a.Name = name
		artifacts = append(artifacts, a)
	}

	for i, a := range artifacts {
		if a.SHA256 == "" {
			problems = append(problems, fmt.Sprintf("%s has no sha256 in the template, like \"$SHASUM\"", a.Name))
		}
		if got := countVersionedTargets(a, version); got != 1 {
			problems = append(problems, fmt.Sprintf("%s needs exactly one versioned s3 target (v%s/), found %d", a.Name, version, got))
		}
		for _, t := range a.Targets {
			if msg := checkTarget(t); msg != "" {
				problems = append(problems, fmt.Sprintf("%s: %s", a.Name, msg))
			}
		}

		sum, err := hashFile(filepath.Join(dir, filepath.FromSlash(a.Name)))
		if err != nil {
			problems = append(problems, fmt.Sprintf("%s is declared but cannot be read: %v", a.Name, err))
			artifacts[i].SHA256 = "" // keeps the unfilled $SHASUM out of the placeholder check
			continue
		}
		artifacts[i].SHA256 = strings.ReplaceAll(a.SHA256, "$SHASUM", sum)
	}

	undeclared, err := findUndeclared(dir, seen)
	if err != nil {
		problems = append(problems, err.Error())
	}
	for _, name := range undeclared {
		problems = append(problems, fmt.Sprintf("%s was built but is not declared in the manifest", name))
	}

	m.Artifacts = artifacts
	encoded, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	leftovers := placeholderPattern.FindAllString(string(encoded), -1)
	for _, placeholder := range slices.Compact(slices.Sorted(slices.Values(leftovers))) {
		problems = append(problems, fmt.Sprintf("placeholder %s was not filled in", placeholder))
	}

	if len(problems) > 0 {
		return nil, fmt.Errorf("%d problem(s) with the artifacts manifest:\n  - %s", len(problems), strings.Join(problems, "\n  - "))
	}
	return &m, nil
}

func fillTargets(targets []Target, replacer *strings.Replacer, channel string) []Target {
	var out []Target
	for _, t := range targets {
		isChannelFolder := t.Type == targetS3 && strings.Contains(t.Path, "$CHANNEL")
		// The dev channel is what e2e branches build. They only upload the versioned folder.
		if channel == channelDev && isChannelFolder {
			continue
		}
		filled := Target{Type: t.Type, Path: replacer.Replace(t.Path)}
		out = append(out, filled)
		if channel == channelStable && isChannelFolder {
			out = append(out, Target{Type: t.Type, Path: strings.ReplaceAll(t.Path, "$CHANNEL", "latest")})
		}
	}
	return out
}

func checkTarget(t Target) string {
	switch t.Type {
	case targetS3:
		if t.Path == "" || !strings.HasSuffix(t.Path, "/") {
			return fmt.Sprintf("s3 target path %q must be a folder ending in /", t.Path)
		}
	case targetGitHub, targetNPM:
		if t.Path != "" {
			return fmt.Sprintf("%s targets don't take a path", t.Type)
		}
	default:
		return fmt.Sprintf("unknown target type %q", t.Type)
	}
	return ""
}

func countVersionedTargets(a Artifact, version string) int {
	count := 0
	for _, t := range a.Targets {
		if t.Type == targetS3 && versionedFolder(t.Path, version) {
			count++
		}
	}
	return count
}

func versionedFolder(p, version string) bool {
	return strings.HasSuffix(p, "/v"+version+"/")
}

func cleanPath(name string) (string, error) {
	if !strings.HasPrefix(name, "./") {
		return "", fmt.Errorf("name %q must start with ./", name)
	}
	clean := path.Clean(name)
	if clean == ".." || strings.HasPrefix(clean, "../") || path.IsAbs(clean) {
		return "", fmt.Errorf("name %q points outside the build output", name)
	}
	return "./" + clean, nil
}

func findUndeclared(dir string, declared map[string]bool) ([]string, error) {
	var undeclared []string
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(dir, p)
		if err != nil {
			return err
		}
		name := "./" + filepath.ToSlash(rel)
		if declared[name] || isIgnored(name) {
			return nil
		}
		undeclared = append(undeclared, name)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("listing %s: %w", dir, err)
	}
	return undeclared, nil
}

// The build also writes a checksum next to each npm tarball, and signing leaves the unsigned
// sha256sums.txt next to each sha256sums.txt.asc. Neither is uploaded, unlike the checksums next to
// binaries, which the template declares.
func isIgnored(name string) bool {
	return strings.HasSuffix(name, ".tgz.sha256") ||
		path.Base(name) == "sha256sums.txt" ||
		name == "./"+manifestName
}

func hashFile(p string) (string, error) {
	f, err := os.Open(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
