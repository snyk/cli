package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

type npmManifest struct {
	Name string `json:"name"`
}

func readNpmManifestName(t *testing.T, path string) string {
	t.Helper()

	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var manifest npmManifest
	if err := json.Unmarshal(contents, &manifest); err != nil {
		t.Fatalf("parsing %s: %v", path, err)
	}
	return manifest.Name
}

func copyFile(t *testing.T, source, destination string) {
	t.Helper()

	contents, err := os.ReadFile(source)
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(source)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(destination, contents, info.Mode()); err != nil {
		t.Fatal(err)
	}
}

func TestCreateNpmArtifactPublishesTheBinaryWrapperAsSnyk(t *testing.T) {
	if _, err := exec.LookPath("npm"); err != nil {
		t.Fatal("npm is required to pack the npm artifact")
	}

	root := t.TempDir()
	copyFile(t, repoPath(t, "package.json"), filepath.Join(root, "package.json"))
	copyFile(t, repoPath(t, "bin", "snyk"), filepath.Join(root, "bin", "snyk"))
	wrapperDir := filepath.Join(root, "ts-binary-wrapper")
	copyFile(t, repoPath(t, "ts-binary-wrapper", "package.json"), filepath.Join(wrapperDir, "package.json"))
	copyFile(t, repoPath(t, "ts-binary-wrapper", "bin", "snyk"), filepath.Join(wrapperDir, "bin", "snyk"))
	if err := os.MkdirAll(filepath.Join(root, "binary-releases"), 0755); err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command(repoPath(t, "release-scripts", "create-npm-artifact.sh"), "binary-releases", "ts-binary-wrapper")
	cmd.Dir = root
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("create-npm-artifact.sh failed: %v\n%s", err, output)
	}

	extracted := t.TempDir()
	untar := exec.Command("tar", "-xzf", filepath.Join(root, "binary-releases", "snyk.tgz"), "-C", extracted)
	if output, err := untar.CombinedOutput(); err != nil {
		t.Fatalf("extracting snyk.tgz failed: %v\n%s", err, output)
	}

	published, err := os.ReadFile(filepath.Join(extracted, "package", "package.json"))
	if err != nil {
		t.Fatal(err)
	}
	wrapper, err := os.ReadFile(repoPath(t, "ts-binary-wrapper", "package.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(published) != string(wrapper) {
		t.Errorf("published package.json is not the binary wrapper's:\n%s", published)
	}
	if name := readNpmManifestName(t, filepath.Join(extracted, "package", "package.json")); name != "snyk" {
		t.Errorf("published package name = %q, want %q", name, "snyk")
	}
	publishedBin, err := os.ReadFile(filepath.Join(extracted, "package", "bin", "snyk"))
	if err != nil {
		t.Fatalf("published package has no bin/snyk: %v", err)
	}
	wrapperBin, err := os.ReadFile(repoPath(t, "ts-binary-wrapper", "bin", "snyk"))
	if err != nil {
		t.Fatal(err)
	}
	if string(publishedBin) != string(wrapperBin) {
		t.Errorf("published bin/snyk is not the binary wrapper's:\n%s", publishedBin)
	}
}

func TestRootAndBinaryWrapperManifestsHaveDistinctNames(t *testing.T) {
	rootName := readNpmManifestName(t, repoPath(t, "package.json"))
	wrapperName := readNpmManifestName(t, repoPath(t, "ts-binary-wrapper", "package.json"))

	if rootName == wrapperName {
		t.Errorf("root package.json and ts-binary-wrapper/package.json are both named %q, so snyk monitor reports them as one project", rootName)
	}
}

func TestRootManifestIsNotPrivateSoPkgEmbedsSourcesForNoBytecodeBuilds(t *testing.T) {
	contents, err := os.ReadFile(repoPath(t, "package.json"))
	if err != nil {
		t.Fatal(err)
	}
	var manifest struct {
		Private bool `json:"private"`
	}
	if err := json.Unmarshal(contents, &manifest); err != nil {
		t.Fatal(err)
	}

	if manifest.Private {
		t.Error("root package.json is private, so pkg skips embedding its sources and the arm64 --no-bytecode builds fail with \"--no-bytecode and no source breaks final executable\"")
	}
}

func TestRootLockfileNamesMatchRootManifest(t *testing.T) {
	rootName := readNpmManifestName(t, repoPath(t, "package.json"))

	contents, err := os.ReadFile(repoPath(t, "package-lock.json"))
	if err != nil {
		t.Fatal(err)
	}
	var lockfile struct {
		Name     string                 `json:"name"`
		Packages map[string]npmManifest `json:"packages"`
	}
	if err := json.Unmarshal(contents, &lockfile); err != nil {
		t.Fatal(err)
	}

	if lockfile.Name != rootName {
		t.Errorf("package-lock.json name = %q, want %q", lockfile.Name, rootName)
	}
	if lockfile.Packages[""].Name != rootName {
		t.Errorf("package-lock.json packages[\"\"].name = %q, want %q", lockfile.Packages[""].Name, rootName)
	}
}
