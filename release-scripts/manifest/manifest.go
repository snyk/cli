// Package manifest defines the artifacts manifest, the contract between the build and every
// deployment target.
package manifest

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
