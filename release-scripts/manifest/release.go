package manifest

// ReleaseJSON is the release.json a folder of the download bucket serves, listing its binaries.
type ReleaseJSON struct {
	Version       string           `json:"version"`
	Assets        map[string]Asset `json:"assets"`
	SchemaVersion int              `json:"schemaVersion"`
}

type Asset struct {
	URL       string `json:"url"`
	SHA256    string `json:"sha256"`
	SHA256URL string `json:"sha256Url"`
}
