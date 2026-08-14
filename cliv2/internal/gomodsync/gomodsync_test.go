package gomodsync

import (
	"bytes"
	"strings"
	"testing"

	"golang.org/x/mod/modfile"
)

const pubHeader = "module example.com/pub\n\ngo 1.22\n\n"
const privHeader = "module example.com/priv\n\ngo 1.22\n\n"

func parseMod(t *testing.T, content string) *modfile.File {
	t.Helper()
	f, err := modfile.Parse("test.mod", []byte(content), nil)
	if err != nil {
		t.Fatalf("parse go.mod: %v", err)
	}
	return f
}

// --- CompareVersions ---

func TestCompareVersions_Equal(t *testing.T) {
	if CompareVersions("v1.2.3", "v1.2.3") != 0 {
		t.Error("expected equal")
	}
}

func TestCompareVersions_Less(t *testing.T) {
	if CompareVersions("v1.0.0", "v1.2.0") >= 0 {
		t.Error("expected v1.0.0 < v1.2.0")
	}
}

func TestCompareVersions_Greater(t *testing.T) {
	if CompareVersions("v1.5.0", "v1.3.0") <= 0 {
		t.Error("expected v1.5.0 > v1.3.0")
	}
}

func TestCompareVersions_PseudoVersions(t *testing.T) {
	a := "v0.0.0-20260101000000-aaaaaaaaaaaa"
	b := "v0.0.0-20260601000000-bbbbbbbbbbbb"
	if CompareVersions(a, b) >= 0 {
		t.Errorf("expected %s < %s", a, b)
	}
}

// --- FindVersionDrift ---

func TestFindVersionDrift_InSync(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.0.0\n")
	if got := FindVersionDrift(pub, priv); len(got) != 0 {
		t.Errorf("expected no drift, got %d", len(got))
	}
}

func TestFindVersionDrift_PrivateHigher(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.2.0\n")
	got := FindVersionDrift(pub, priv)
	if len(got) != 1 {
		t.Fatalf("expected 1 mismatch, got %d", len(got))
	}
	if got[0].PublicVer != "v1.0.0" || got[0].PrivateVer != "v1.2.0" {
		t.Errorf("unexpected: pub=%s priv=%s", got[0].PublicVer, got[0].PrivateVer)
	}
}

func TestFindVersionDrift_PublicHigher(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.5.0\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.3.0\n")
	got := FindVersionDrift(pub, priv)
	if len(got) != 1 {
		t.Fatalf("expected 1 mismatch, got %d", len(got))
	}
	if got[0].PublicVer != "v1.5.0" || got[0].PrivateVer != "v1.3.0" {
		t.Errorf("unexpected: pub=%s priv=%s", got[0].PublicVer, got[0].PrivateVer)
	}
}

func TestFindVersionDrift_IgnoresNonSharedDeps(t *testing.T) {
	pub := parseMod(t, pubHeader+"require (\n\tgithub.com/foo/bar v1.0.0\n\tgithub.com/only/pub v0.2.0\n)\n")
	priv := parseMod(t, privHeader+"require (\n\tgithub.com/foo/bar v1.0.0\n\tgithub.com/only/priv v0.3.0\n)\n")
	if got := FindVersionDrift(pub, priv); len(got) != 0 {
		t.Errorf("expected no drift for non-shared deps, got %d", len(got))
	}
}

func TestFindVersionDrift_MultipleModulesSorted(t *testing.T) {
	pub := parseMod(t, pubHeader+"require (\n\tgithub.com/z/z v1.0.0\n\tgithub.com/a/a v1.0.0\n)\n")
	priv := parseMod(t, privHeader+"require (\n\tgithub.com/z/z v1.1.0\n\tgithub.com/a/a v1.1.0\n)\n")
	got := FindVersionDrift(pub, priv)
	if len(got) != 2 {
		t.Fatalf("expected 2 mismatches, got %d", len(got))
	}
	if got[0].Module != "github.com/a/a" {
		t.Errorf("expected sorted order, first=%s", got[0].Module)
	}
}

// --- FindReplaceDrift ---

func TestFindReplaceDrift_IgnoresPublicOnlyReplace(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar v1.0.0 => github.com/foo/bar v1.0.1\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.0.0\n")
	if got := FindReplaceDrift(pub, priv); len(got) != 0 {
		t.Errorf("expected public-only replace to be ignored, got %d mismatches", len(got))
	}
}

func TestFindReplaceDrift_DetectsPrivateOnlyReplace(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar => ../local-bar\n")
	got := FindReplaceDrift(pub, priv)
	if len(got) != 1 {
		t.Fatalf("expected 1 mismatch, got %d", len(got))
	}
	if got[0].InPublic || !got[0].InPrivate {
		t.Errorf("expected InPublic=false InPrivate=true")
	}
}

func TestFindReplaceDrift_DetectsDifferingTargets(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar => ../old-bar\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar => ../new-bar\n")
	got := FindReplaceDrift(pub, priv)
	if len(got) != 1 {
		t.Fatalf("expected 1 mismatch, got %d", len(got))
	}
	if !got[0].InPublic || !got[0].InPrivate {
		t.Errorf("expected both InPublic and InPrivate true")
	}
}

func TestFindReplaceDrift_IgnoresNonSharedModule(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/only/pub v1.0.0\n\nreplace github.com/only/pub => ../local\n")
	priv := parseMod(t, privHeader+"require github.com/only/priv v1.0.0\n")
	if got := FindReplaceDrift(pub, priv); len(got) != 0 {
		t.Errorf("expected no drift for non-shared module replace, got %d", len(got))
	}
}

// --- ReportDrift ---

func TestReportDrift_InSync(t *testing.T) {
	var buf bytes.Buffer
	code := ReportDrift(&buf, nil, nil)
	if code != 0 {
		t.Errorf("expected exit 0, got %d", code)
	}
	if !strings.Contains(buf.String(), "in sync") {
		t.Errorf("expected 'in sync', got: %s", buf.String())
	}
}

func TestReportDrift_WithMismatches(t *testing.T) {
	var buf bytes.Buffer
	code := ReportDrift(&buf, []VersionMismatch{{Module: "foo", PublicVer: "v1", PrivateVer: "v2"}}, nil)
	if code != 1 {
		t.Errorf("expected exit 1, got %d", code)
	}
	if !strings.Contains(buf.String(), "mismatch") {
		t.Errorf("expected 'mismatch', got: %s", buf.String())
	}
}

// --- ApplySync ---

func TestApplySync_UpgradesVersion(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n")
	drift := []VersionMismatch{{Module: "github.com/foo/bar", PublicVer: "v1.0.0", PrivateVer: "v1.2.0"}}
	ApplySync(&bytes.Buffer{}, pub, drift, nil)

	for _, r := range pub.Require {
		if r.Mod.Path == "github.com/foo/bar" {
			if r.Mod.Version != "v1.2.0" {
				t.Errorf("expected v1.2.0, got %s", r.Mod.Version)
			}
			return
		}
	}
	t.Error("module not found in require block")
}

func TestApplySync_DowngradesVersion(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.5.0\n")
	drift := []VersionMismatch{{Module: "github.com/foo/bar", PublicVer: "v1.5.0", PrivateVer: "v1.3.0"}}
	ApplySync(&bytes.Buffer{}, pub, drift, nil)

	for _, r := range pub.Require {
		if r.Mod.Path == "github.com/foo/bar" {
			if r.Mod.Version != "v1.3.0" {
				t.Errorf("expected v1.3.0, got %s", r.Mod.Version)
			}
			return
		}
	}
	t.Error("module not found in require block")
}

func TestApplySync_AddsReplaceFromPrivate(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar => ../local-bar\n")
	drift := FindReplaceDrift(pub, priv)
	ApplySync(&bytes.Buffer{}, pub, nil, drift)

	pub.Cleanup()
	out, _ := pub.Format()
	if !strings.Contains(string(out), "local-bar") {
		t.Errorf("expected replace added:\n%s", out)
	}
}

func TestApplySync_PreservesPublicOnlyReplace(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar v1.0.0 => github.com/foo/bar v1.0.1\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.0.0\n")
	drift := FindReplaceDrift(pub, priv)
	ApplySync(&bytes.Buffer{}, pub, nil, drift)

	pub.Cleanup()
	out, _ := pub.Format()
	if !strings.Contains(string(out), "replace") {
		t.Errorf("expected public-only replace preserved:\n%s", out)
	}
}

func TestApplySync_UpdatesReplaceToDifferentTarget(t *testing.T) {
	pub := parseMod(t, pubHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar => ../old-bar\n")
	priv := parseMod(t, privHeader+"require github.com/foo/bar v1.0.0\n\nreplace github.com/foo/bar => ../new-bar\n")
	drift := FindReplaceDrift(pub, priv)
	ApplySync(&bytes.Buffer{}, pub, nil, drift)

	pub.Cleanup()
	out, _ := pub.Format()
	if !strings.Contains(string(out), "new-bar") || strings.Contains(string(out), "old-bar") {
		t.Errorf("expected replace target updated:\n%s", out)
	}
}
