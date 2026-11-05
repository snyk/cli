// Package manifest defines the artifacts manifest, the contract between the build and every
// deployment target.
package manifest

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

const (
	TargetS3     = "s3"
	TargetGitHub = "github"
	TargetNPM    = "npm"
)

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

// Read parses a filled-in manifest, not the template.
func Read(file string) (*Manifest, error) {
	content, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	var m Manifest
	if err := json.Unmarshal(content, &m); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", file, err)
	}
	if m.Meta.Version == "" || m.Meta.ReleaseChannel == "" {
		return nil, fmt.Errorf("%s has no meta.version or meta.releaseChannel, is it a filled-in manifest?", file)
	}
	return &m, nil
}

// VersionedFolder is the S3 folder every file is uploaded to before any channel, like cli/v1.2.3/.
// A channel folder then gets a copy, like cli/preview/ or cli/rc/.
func (m *Manifest) VersionedFolder(a Artifact) (string, bool) {
	for _, t := range a.Targets {
		if t.Type == TargetS3 && strings.HasSuffix(t.Path, "/v"+m.Meta.Version+"/") {
			return t.Path, true
		}
	}
	return "", false
}

// ArtifactsWithTarget returns the artifacts that have a target of the given type.
func (m *Manifest) ArtifactsWithTarget(targetType string) []Artifact {
	var out []Artifact
	for _, a := range m.Artifacts {
		for _, t := range a.Targets {
			if t.Type == targetType {
				out = append(out, a)
				break
			}
		}
	}
	return out
}

// NonVersionedS3Folders returns the artifact's S3 folders other than its versioned one, which are
// the channel folders it is published to.
func (m *Manifest) NonVersionedS3Folders(a Artifact) []string {
	versioned, _ := m.VersionedFolder(a)
	var folders []string
	for _, t := range a.Targets {
		if t.Type == TargetS3 && t.Path != versioned {
			folders = append(folders, t.Path)
		}
	}
	return folders
}
