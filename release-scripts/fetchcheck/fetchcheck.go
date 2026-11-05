// Package fetchcheck is the first step of every deployment target: it downloads the files of a
// filled-in artifacts manifest that have a target of a given type, and checks each one against the
// sha256 in the manifest, so a target deploys exactly what the build declared.
package fetchcheck

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/snyk/cli/release-scripts/manifest"
)

const maxAttempts = 3

type Fetcher struct {
	Client *http.Client
	// BaseURL serves the bucket's folders, like https://downloads.snyk.io/. The CI role can't read
	// from the bucket, so files come over HTTPS instead of being copied inside S3.
	BaseURL string
	// Backoff is the wait before the given retry. Nil waits a second per attempt.
	Backoff func(attempt int) time.Duration
}

// Fetch downloads the given artifacts from their versioned folder into dest, under their manifest
// name, and checks their checksums. It reports every file that failed, not only the first.
func (f *Fetcher) Fetch(m *manifest.Manifest, artifacts []manifest.Artifact, dest string) error {
	if len(artifacts) == 0 {
		return errors.New("no files to fetch")
	}

	var errs []error
	for _, a := range artifacts {
		if err := f.fetchOne(m, a, dest); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (f *Fetcher) fetchOne(m *manifest.Manifest, a manifest.Artifact, dest string) error {
	folder, ok := m.VersionedFolder(a)
	if !ok {
		return fmt.Errorf("%s has no versioned s3 target", a.Name)
	}
	relative := strings.TrimPrefix(path.Clean(a.Name), "./")
	if relative == ".." || strings.HasPrefix(relative, "../") || path.IsAbs(relative) {
		return fmt.Errorf("%s points outside the destination", a.Name)
	}
	url := strings.TrimSuffix(f.BaseURL, "/") + "/" + folder + path.Base(relative)
	file := filepath.Join(dest, filepath.FromSlash(relative))

	sum, err := f.download(url, file)
	if err != nil {
		return fmt.Errorf("downloading %s: %w", url, err)
	}
	if sum != a.SHA256 {
		return fmt.Errorf("checksum mismatch for %s: manifest has %s, %s has %s", a.Name, a.SHA256, url, sum)
	}
	return nil
}

func (f *Fetcher) download(url, file string) (string, error) {
	if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
		return "", err
	}

	var err error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		var sum string
		var retryable bool
		sum, retryable, err = f.downloadOnce(url, file)
		if err == nil || !retryable {
			return sum, err
		}
		if attempt < maxAttempts {
			time.Sleep(f.backoff(attempt))
		}
	}
	return "", err
}

// downloadOnce reports whether a failure is worth retrying: the server or the connection failed,
// not the request.
func (f *Fetcher) downloadOnce(url, file string) (sum string, retryable bool, err error) {
	resp, err := f.Client.Get(url)
	if err != nil {
		return "", true, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", resp.StatusCode >= http.StatusInternalServerError, fmt.Errorf("unexpected status %s", resp.Status)
	}

	out, err := os.Create(file)
	if err != nil {
		return "", false, err
	}
	defer out.Close()
	hash := sha256.New()
	if _, err := io.Copy(io.MultiWriter(out, hash), resp.Body); err != nil {
		return "", true, err
	}
	return hex.EncodeToString(hash.Sum(nil)), false, nil
}

func (f *Fetcher) backoff(attempt int) time.Duration {
	if f.Backoff != nil {
		return f.Backoff(attempt)
	}
	return time.Duration(attempt) * time.Second
}
