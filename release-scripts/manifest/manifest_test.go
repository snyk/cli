package manifest

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeManifest(t *testing.T, content string) string {
	t.Helper()
	file := filepath.Join(t.TempDir(), "artifacts-manifest.json")
	if err := os.WriteFile(file, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return file
}

func TestReadParsesAFilledInManifest(t *testing.T) {
	file := writeManifest(t, `{"schemaVersion":1,"meta":{"version":"1.2.3","commit":"abc","releaseChannel":"rc"},
		"artifacts":[{"name":"./snyk-linux","sha256":"x","targets":[{"type":"s3","path":"cli/v1.2.3/"}]}]}`)

	m, err := Read(file)

	if err != nil {
		t.Fatal(err)
	}
	if m.Meta.ReleaseChannel != "rc" || len(m.Artifacts) != 1 || m.Artifacts[0].Targets[0].Path != "cli/v1.2.3/" {
		t.Fatalf("unexpected manifest %+v", m)
	}
}

func TestReadRejectsATemplate(t *testing.T) {
	file := writeManifest(t, `{"schemaVersion":1,"meta":{},"artifacts":[]}`)

	_, err := Read(file)

	if err == nil || !strings.Contains(err.Error(), "filled-in manifest") {
		t.Fatalf("expected a not-filled-in error, got %v", err)
	}
}

func TestVersionedFolderIsTheFolderEndingInTheVersion(t *testing.T) {
	m := &Manifest{Meta: Meta{Version: "1.2.3"}}
	a := Artifact{Targets: []Target{{Type: TargetS3, Path: "cli/preview/"}, {Type: TargetS3, Path: "cli/v1.2.3/"}}}

	folder, ok := m.VersionedFolder(a)

	if !ok || folder != "cli/v1.2.3/" {
		t.Fatalf("got %q, %v", folder, ok)
	}
}

func TestNonVersionedS3FoldersAreTheChannelFolders(t *testing.T) {
	m := &Manifest{Meta: Meta{Version: "1.2.3"}}
	a := Artifact{Targets: []Target{{Type: TargetS3, Path: "cli/v1.2.3/"}, {Type: TargetS3, Path: "cli/stable/"}, {Type: TargetS3, Path: "cli/latest/"}, {Type: TargetGitHub}}}

	folders := m.NonVersionedS3Folders(a)

	if strings.Join(folders, ",") != "cli/stable/,cli/latest/" {
		t.Fatalf("got %v", folders)
	}
}

func TestNonVersionedS3FoldersIsEmptyForAVersionedOnlyFile(t *testing.T) {
	m := &Manifest{Meta: Meta{Version: "1.2.3"}}
	a := Artifact{Targets: []Target{{Type: TargetS3, Path: "cli/v1.2.3/"}, {Type: TargetNPM}}}

	if folders := m.NonVersionedS3Folders(a); len(folders) != 0 {
		t.Fatalf("got %v", folders)
	}
}

func TestReadRejectsS3FoldersThatCouldWriteOutsideAChannelFolder(t *testing.T) {
	folders := []string{
		// escaping the bucket prefix
		"../cli/preview/", "cli/../../other/", "/cli/preview/",
		// a key like snyk-linux at the bucket root, or cli/previewsnyk-linux
		"", "./", "cli/preview", "cli//preview/", "cli/./preview/",
	}
	for _, folder := range folders {
		file := writeManifest(t, `{"schemaVersion":1,"meta":{"version":"1.2.3","commit":"abc","releaseChannel":"preview"},
			"artifacts":[{"name":"./snyk-linux","sha256":"x","targets":[{"type":"s3","path":"`+folder+`"}]}]}`)

		_, err := Read(file)

		if err == nil || !strings.Contains(err.Error(), "s3 path") {
			t.Errorf("expected %q to be rejected as an s3 path, got %v", folder, err)
		}
	}
}
