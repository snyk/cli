// Command release-s3-v2 publishes the files of a filled-in artifacts manifest to each of their S3
// channel folders, which are the s3 targets other than the versioned folder.
//
//	go run ./release-s3-v2 --dry-run <manifest>
//
// Only --dry-run is supported for now: it fetches and checks the files, then prints the S3 keys it
// would write instead of uploading them.
package main

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/snyk/cli/release-scripts/fetchcheck"
	"github.com/snyk/cli/release-scripts/manifest"
)

const (
	defaultBucket  = "snyk-assets"
	defaultBaseURL = "https://downloads.snyk.io/"
)

func main() {
	bucket := getenv("PUBLIC_S3_BUCKET", defaultBucket)
	baseURL := getenv("DOWNLOADS_BASE_URL", defaultBaseURL)
	if err := run(os.Args[1:], os.Stdout, bucket, baseURL); err != nil {
		fmt.Fprintln(os.Stderr, "release-s3-v2:", err)
		os.Exit(1)
	}
}

func getenv(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func run(args []string, stdout io.Writer, bucket, baseURL string) error {
	if len(args) != 2 || args[0] != "--dry-run" {
		return errors.New("usage: release-s3-v2 --dry-run <manifest>")
	}
	m, err := manifest.Read(args[1])
	if err != nil {
		return err
	}

	downloads, err := os.MkdirTemp("", "release-s3-v2-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(downloads)

	fetcher := &fetchcheck.Fetcher{Client: &http.Client{Timeout: 5 * time.Minute}, BaseURL: baseURL}
	if err := fetcher.Fetch(m, channelArtifacts(m), downloads); err != nil {
		return err
	}

	fmt.Fprintf(stdout, "DRY RUN: would publish v%s to the %s channel:\n", m.Meta.Version, m.Meta.ReleaseChannel)
	for _, u := range releaseJSONLast(nonVersionedUploads(m)) {
		fmt.Fprintf(stdout, "%s -> s3://%s/%s\n", u.srcName, bucket, u.s3Target)
	}
	return nil
}

// upload is one manifest file going to one S3 key.
type upload struct {
	srcName  string
	s3Target string
}

// channelArtifacts are the artifacts published to at least one channel folder. The others, like the
// npm tarballs, only live in their versioned folder.
func channelArtifacts(m *manifest.Manifest) []manifest.Artifact {
	var artifacts []manifest.Artifact
	for _, a := range m.ArtifactsWithTarget(manifest.TargetS3) {
		if len(m.NonVersionedS3Folders(a)) > 0 {
			artifacts = append(artifacts, a)
		}
	}
	return artifacts
}

// nonVersionedUploads lists every file once per folder other than its versioned one, which the
// versioned upload already filled.
func nonVersionedUploads(m *manifest.Manifest) []upload {
	var uploads []upload
	for _, a := range channelArtifacts(m) {
		for _, folder := range m.NonVersionedS3Folders(a) {
			uploads = append(uploads, upload{srcName: a.Name, s3Target: folder + a.Name[strings.LastIndex(a.Name, "/")+1:]})
		}
	}
	return uploads
}

// releaseJSONLast moves every release.json after all other uploads, so a folder's release.json
// never points at files that haven't landed yet.
func releaseJSONLast(uploads []upload) []upload {
	return slices.SortedStableFunc(slices.Values(uploads), func(a, b upload) int {
		return boolToInt(isReleaseJSON(a.s3Target)) - boolToInt(isReleaseJSON(b.s3Target))
	})
}

func isReleaseJSON(key string) bool {
	return strings.HasSuffix(key, "/release.json")
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
