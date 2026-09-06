package gomodsync

import (
	"fmt"
	"io"
	"sort"

	"golang.org/x/mod/modfile"
	"golang.org/x/mod/semver"
)

type VersionMismatch struct {
	Module     string
	PublicVer  string
	PrivateVer string
}

type ReplaceMismatch struct {
	Module         string
	InPublic       bool
	InPrivate      bool
	PublicReplace  *modfile.Replace
	PrivateReplace *modfile.Replace
}

func FindVersionDrift(pub, priv *modfile.File) []VersionMismatch {
	pubReqs := make(map[string]string)
	for _, r := range pub.Require {
		pubReqs[r.Mod.Path] = r.Mod.Version
	}

	var mismatches []VersionMismatch
	for _, r := range priv.Require {
		pubVer, shared := pubReqs[r.Mod.Path]
		if !shared {
			continue
		}
		if CompareVersions(r.Mod.Version, pubVer) != 0 {
			mismatches = append(mismatches, VersionMismatch{
				Module:     r.Mod.Path,
				PublicVer:  pubVer,
				PrivateVer: r.Mod.Version,
			})
		}
	}

	sort.Slice(mismatches, func(i, j int) bool {
		return mismatches[i].Module < mismatches[j].Module
	})
	return mismatches
}

func FindReplaceDrift(pub, priv *modfile.File) []ReplaceMismatch {
	pubReqs := make(map[string]bool)
	for _, r := range pub.Require {
		pubReqs[r.Mod.Path] = true
	}
	privReqs := make(map[string]bool)
	for _, r := range priv.Require {
		privReqs[r.Mod.Path] = true
	}

	type replaceKey struct{ old, oldVer string }
	pubReplaces := make(map[replaceKey]*modfile.Replace)
	for _, r := range pub.Replace {
		pubReplaces[replaceKey{r.Old.Path, r.Old.Version}] = r
	}
	privReplaces := make(map[replaceKey]*modfile.Replace)
	for _, r := range priv.Replace {
		privReplaces[replaceKey{r.Old.Path, r.Old.Version}] = r
	}

	seen := make(map[replaceKey]bool)
	var mismatches []ReplaceMismatch

	for k, pubR := range pubReplaces {
		seen[k] = true
		if !privReqs[k.old] {
			continue
		}
		privR, inPriv := privReplaces[k]
		// Public-only replaces are intentional (e.g. license compliance pins)
		// and not drift — skip them.
		if inPriv && (pubR.New.Path != privR.New.Path || pubR.New.Version != privR.New.Version) {
			mismatches = append(mismatches, ReplaceMismatch{
				Module:         k.old,
				InPublic:       true,
				InPrivate:      true,
				PublicReplace:  pubR,
				PrivateReplace: privR,
			})
		}
	}

	for k, privR := range privReplaces {
		if seen[k] {
			continue
		}
		if !pubReqs[k.old] {
			continue
		}
		mismatches = append(mismatches, ReplaceMismatch{
			Module:         k.old,
			InPublic:       false,
			InPrivate:      true,
			PrivateReplace: privR,
		})
	}

	sort.Slice(mismatches, func(i, j int) bool {
		return mismatches[i].Module < mismatches[j].Module
	})
	return mismatches
}

// ReportDrift writes a human-readable drift report and returns a non-zero exit
// code when drift is found.
func ReportDrift(w io.Writer, versions []VersionMismatch, replaces []ReplaceMismatch) int {
	if len(versions) == 0 && len(replaces) == 0 {
		_, _ = fmt.Fprintln(w, "go.mod files are in sync")
		return 0
	}

	if len(versions) > 0 {
		_, _ = fmt.Fprintf(w, "Found %d shared dependency version mismatch(es):\n\n", len(versions))
		for _, m := range versions {
			_, _ = fmt.Fprintf(w, "  %s\n", m.Module)
			_, _ = fmt.Fprintf(w, "    public:  %s\n", m.PublicVer)
			_, _ = fmt.Fprintf(w, "    private: %s\n\n", m.PrivateVer)
		}
	}

	if len(replaces) > 0 {
		_, _ = fmt.Fprintf(w, "Found %d replace directive mismatch(es):\n\n", len(replaces))
		for _, m := range replaces {
			switch {
			case !m.InPublic && m.InPrivate:
				_, _ = fmt.Fprintf(w, "  %s\n", m.Module)
				_, _ = fmt.Fprintf(w, "    replace in private but missing in public\n")
				_, _ = fmt.Fprintf(w, "    private: %s => %s %s\n\n",
					m.PrivateReplace.Old.Path, m.PrivateReplace.New.Path, m.PrivateReplace.New.Version)
			default:
				_, _ = fmt.Fprintf(w, "  %s\n", m.Module)
				_, _ = fmt.Fprintf(w, "    replace targets differ\n")
				_, _ = fmt.Fprintf(w, "    public:  => %s %s\n", m.PublicReplace.New.Path, m.PublicReplace.New.Version)
				_, _ = fmt.Fprintf(w, "    private: => %s %s\n\n", m.PrivateReplace.New.Path, m.PrivateReplace.New.Version)
			}
		}
	}

	_, _ = fmt.Fprintln(w, "ERROR: public and private go.mod are out of sync. Run 'make tidy' to fix.")
	return 1
}

// ApplySync updates pubFile in place to match private for all detected drift.
func ApplySync(w io.Writer, pubFile *modfile.File, versions []VersionMismatch, replaces []ReplaceMismatch) {
	for _, m := range versions {
		if err := pubFile.AddRequire(m.Module, m.PrivateVer); err != nil {
			_, _ = fmt.Fprintf(w, "WARNING: could not update %s: %v\n", m.Module, err)
		}
	}

	for _, m := range replaces {
		switch {
		case !m.InPublic && m.InPrivate:
			r := m.PrivateReplace
			if err := pubFile.AddReplace(r.Old.Path, r.Old.Version, r.New.Path, r.New.Version); err != nil {
				_, _ = fmt.Fprintf(w, "WARNING: could not add replace for %s: %v\n", m.Module, err)
			}
		case m.InPublic && m.InPrivate:
			r := m.PrivateReplace
			if err := pubFile.AddReplace(r.Old.Path, r.Old.Version, r.New.Path, r.New.Version); err != nil {
				_, _ = fmt.Fprintf(w, "WARNING: could not update replace for %s: %v\n", m.Module, err)
			}
		}
	}
}

func CompareVersions(a, b string) int {
	if semver.IsValid("v"+a) && !semver.IsValid(a) {
		a = "v" + a
	}
	if semver.IsValid("v"+b) && !semver.IsValid(b) {
		b = "v" + b
	}
	return semver.Compare(a, b)
}
