// Command release-s3-v2 publishes the files of a filled-in artifacts manifest to each of their S3
// channel folders, which are the s3 targets other than the versioned folder.
//
//	go run ./release-s3-v2 [--dry-run] [--echo] <manifest>
//
// It fetches and checks the files, then uploads each one with `aws s3 cp`, so the content types
// stay the ones the AWS CLI guesses. The upload is a dry run of every command followed by the real
// ones. --dry-run stops after the dry run. --echo prints the commands without running any, which
// together with --dry-run shows what a dry run would run. A manifest without channel folders has
// nothing to publish.
package main

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
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
	if err := run(os.Args[1:], os.Stdout, bucket, baseURL, execAWS); err != nil {
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

const usage = "usage: release-s3-v2 [--dry-run] [--echo] <manifest>"

// awsRunner runs the aws command with the given arguments.
type awsRunner func(args ...string) error

func execAWS(args ...string) error {
	cmd := exec.Command("aws", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

type options struct {
	dryRun           bool
	echo             bool
	manifestFilePath string
}

func parseArgs(args []string) (options, error) {
	var opts options
	var positional []string
	for _, arg := range args {
		switch arg {
		case "--dry-run":
			opts.dryRun = true
		case "--echo":
			opts.echo = true
		default:
			positional = append(positional, arg)
		}
	}
	if len(positional) != 1 || strings.HasPrefix(positional[0], "-") {
		return options{}, errors.New(usage)
	}
	opts.manifestFilePath = positional[0]
	return opts, nil
}

func run(args []string, stdout io.Writer, bucket, baseURL string, aws awsRunner) error {
	opts, err := parseArgs(args)
	if err != nil {
		return err
	}
	m, err := manifest.Read(opts.manifestFilePath)
	if err != nil {
		return err
	}

	uploads := releaseJSONLast(nonVersionedUploads(m))
	if len(uploads) == 0 {
		fmt.Fprintf(stdout, "v%s has nothing to publish for the %s channel, it has no channel folders.\n", m.Meta.Version, m.Meta.ReleaseChannel)
		return nil
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

	// Dry run first so a bad command shows before the first real upload. aws --dryrun makes no S3
	// request, so it can't catch permission or bucket errors.
	dryRunOpts := opts
	dryRunOpts.dryRun = true
	fmt.Fprintf(stdout, "Dry run publishing v%s to the %s channel:\n", m.Meta.Version, m.Meta.ReleaseChannel)
	if err := copyToS3(dryRunOpts, stdout, aws, bucket, downloads, uploads); err != nil {
		return fmt.Errorf("dry run failed, nothing was uploaded: %w", err)
	}
	if opts.dryRun {
		return nil
	}

	fmt.Fprintf(stdout, "Publishing v%s to the %s channel:\n", m.Meta.Version, m.Meta.ReleaseChannel)
	return copyToS3(opts, stdout, aws, bucket, downloads, uploads)
}

// copyToS3 prints each aws s3 cp command in order and, unless --echo is set, runs it.
func copyToS3(opts options, stdout io.Writer, aws awsRunner, bucket, downloads string, uploads []upload) error {
	for _, u := range uploads {
		cmdArgs := []string{"s3", "cp", fetchcheck.LocalPath(downloads, u.srcName), "s3://" + bucket + "/" + u.s3Target}
		if opts.dryRun {
			cmdArgs = append(cmdArgs, "--dryrun")
		}
		fmt.Fprintln(stdout, "aws "+strings.Join(cmdArgs, " "))
		if opts.echo {
			continue
		}
		// Stop at the first failure: release.json is last so it never points at files that didn't land.
		if err := aws(cmdArgs...); err != nil {
			return fmt.Errorf("uploading %s: %w", u.srcName, err)
		}
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
