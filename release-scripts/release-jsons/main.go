// Command release-jsons writes a release.json next to the binaries of every folder in the build
// output that declares one in the artifacts manifest template. Run from release-scripts/:
//
//	go run ./release-jsons <build output dir>
//
// It runs before artifacts-manifest fills in the template, so it substitutes $VERSION itself and
// does not depend on the release channel.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/snyk/cli/release-scripts/manifest"
)

const (
	manifestName    = "artifacts-manifest.json"
	releaseJSONName = "release.json"
	checksumSuffix  = ".sha256"
	downloadsURL    = "https://downloads.snyk.io/"
	schemaVersion   = 1
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "release-jsons:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: release-jsons <build output dir>")
	}
	template, err := os.ReadFile(manifestName)
	if err != nil {
		return err
	}
	return Generate(template, args[0])
}

// Generate writes a release.json into outputDir for every release.json the template declares. Nothing
// is written if any of them cannot be built.
func Generate(templateJSON []byte, outputDir string) error {
	version, err := readVersionFile(outputDir)
	if err != nil {
		return err
	}

	var tmpl manifest.Manifest
	if err := json.Unmarshal(templateJSON, &tmpl); err != nil {
		return fmt.Errorf("parsing template: %w", err)
	}

	releases, err := buildReleaseJSONs(tmpl, outputDir, version)
	if err != nil {
		return err
	}

	return writeReleaseJSONs(releases, outputDir)
}

func readVersionFile(outputDir string) (string, error) {
	p := filepath.Join(outputDir, "version")
	content, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(content))
	if version == "" {
		return "", fmt.Errorf("%s is empty", p)
	}
	return version, nil
}

// buildReleaseJSONs builds every release.json the template declares, keyed by its template name. It
// writes nothing, so one folder failing leaves no release.json behind in any folder.
func buildReleaseJSONs(tmpl manifest.Manifest, outputDir, version string) (map[string]manifest.ReleaseJSON, error) {
	releases := map[string]manifest.ReleaseJSON{}
	for _, a := range tmpl.Artifacts {
		if path.Base(a.Name) != releaseJSONName {
			continue
		}
		built, err := buildReleaseJSON(tmpl.Artifacts, outputDir, path.Dir(a.Name), version)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", a.Name, err)
		}
		releases[a.Name] = built
	}
	return releases, nil
}

// buildReleaseJSON lists the binaries in one folder of the template, like "fips" or "." for the root.
// Their .sha256 files are read from the same folder of outputDir.
func buildReleaseJSON(artifacts []manifest.Artifact, outputDir, folder, version string) (manifest.ReleaseJSON, error) {
	declared := map[string]manifest.Artifact{}
	for _, a := range artifacts {
		declared[a.Name] = a
	}

	assets := map[string]manifest.Asset{}
	for _, artifact := range artifacts {
		if path.Dir(artifact.Name) != folder {
			continue
		}
		checksumName := artifact.Name + checksumSuffix
		checksum, hasChecksum := declared[checksumName]
		if !hasChecksum {
			// Tarballs, signatures and protocol version files ship without a .sha256.
			continue
		}

		binaryURL, err := formatDownloadURL(artifact, version)
		if err != nil {
			return manifest.ReleaseJSON{}, err
		}
		checksumURL, err := formatDownloadURL(checksum, version)
		if err != nil {
			return manifest.ReleaseJSON{}, err
		}
		checksumContent, err := os.ReadFile(filepath.Join(outputDir, filepath.FromSlash(checksumName)))
		if err != nil {
			return manifest.ReleaseJSON{}, err
		}
		assets[path.Base(artifact.Name)] = manifest.Asset{
			URL:       binaryURL,
			SHA256:    strings.TrimRight(string(checksumContent), "\r\n"),
			SHA256URL: checksumURL,
		}
	}
	if len(assets) == 0 {
		return manifest.ReleaseJSON{}, fmt.Errorf("no binaries with a %s file in its folder", checksumSuffix)
	}

	return manifest.ReleaseJSON{Version: version, Assets: assets, SchemaVersion: schemaVersion}, nil
}

// formatDownloadURL is where the artifact is served from once it is in its versioned S3 folder.
func formatDownloadURL(a manifest.Artifact, version string) (string, error) {
	for _, t := range a.Targets {
		if t.Type == manifest.TargetS3 && strings.HasSuffix(t.Path, "/v$VERSION/") {
			return downloadsURL + strings.ReplaceAll(t.Path, "$VERSION", version) + path.Base(a.Name), nil
		}
	}
	return "", fmt.Errorf("%s has no versioned s3 target", a.Name)
}

func writeReleaseJSONs(releases map[string]manifest.ReleaseJSON, outputDir string) error {
	for name, release := range releases {
		encoded, err := json.MarshalIndent(release, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(outputDir, filepath.FromSlash(name)), append(encoded, '\n'), 0o644); err != nil {
			return err
		}
	}
	return nil
}
