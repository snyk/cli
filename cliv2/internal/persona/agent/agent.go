// Package agent identifies the coding-tool Harness driving the current CLI
// invocation (e.g. Claude Code, Cursor, Codex), split into a canonical name
// and, when one can be determined, a version.
package agent

import (
	"regexp"
	"strings"

	detectagent "github.com/vercel/detect-agent"
)

// DetectAgent resolves the Harness identifier the current process declared
// via AI_AGENT, or that detect-agent recognised from an environment
// signature. The value is returned exactly as detect-agent produced it: an
// explicit AI_AGENT declaration passes through verbatim (trimmed), a
// signature match is already canonical. No version split or canonicalisation
// is applied here — see SplitVersion.
func DetectAgent() (string, bool) {
	details, err := detectagent.Detect()
	if err != nil {
		return "", false
	}
	return details.Name, true
}

// versionSuffix recognises a version-shaped suffix on a Harness identifier,
// one of two ways:
//
//   - fused onto the name with '_' or '/', with an optional trailing
//     role/surface segment (captured only so it isn't absorbed into the
//     version, then discarded). These are ordinary characters that can end a
//     real name on their own, so at least two numeric components are
//     required to avoid matching a name that merely ends in a single digit.
//   - detect-agent's documented name@version convention for custom AI_AGENT
//     declarations (README example: "devin@1"). '@' is never part of a
//     Harness name, so the separator alone is the version signal and a
//     single numeric component is enough.
//
// Exactly one of the two version groups is populated per match.
var versionSuffix = regexp.MustCompile(`^(?P<name>.+?)(?:[_/](?P<version1>\d+(?:[.\-]\d+){1,3})(?:[_/](?P<role>[A-Za-z0-9-]+))?|@(?P<version2>\d+(?:[.\-]\d+){0,3}))$`)

// knownNames maps a normalised (lowercased, separators stripped) form of
// every Harness name detect-agent knows about to that name's canonical
// spelling, so a version-stripped fragment resolves to the same vocabulary
// detect-agent itself uses rather than a hand-written alias list.
var knownNames = buildKnownNames()

func buildKnownNames() map[string]string {
	m := make(map[string]string, len(detectagent.KnownAgents))
	for _, name := range detectagent.KnownAgents {
		m[normalize(name)] = name
	}
	return m
}

func normalize(s string) string {
	return strings.NewReplacer("_", "", "-", "", "/", "").Replace(strings.ToLower(s))
}

// SplitVersion splits a version-shaped suffix off a raw Harness identifier,
// canonicalising the remaining name fragment against detect-agent's known
// vocabulary when it resolves to one. It returns the identifier unchanged
// with an empty version when no version-shaped suffix is present.
//
// '_'/'/' are ordinary characters that can end a real name on their own, so
// that split is only trusted when the fragment resolves to a known
// Harness — never a guess. '@' is never part of a Harness name (detect-agent's
// own documented convention), so it is unambiguous even for a Harness we
// don't recognise: the fragment is still split off, just left uncanonicalised.
func SplitVersion(raw string) (name string, version string) {
	m := versionSuffix.FindStringSubmatch(raw)
	if m == nil {
		return raw, ""
	}

	fragment := m[versionSuffix.SubexpIndex("name")]
	canonical, known := knownNames[normalize(fragment)]

	if v := m[versionSuffix.SubexpIndex("version2")]; v != "" {
		if known {
			fragment = canonical
		}
		return fragment, strings.ReplaceAll(v, "-", ".")
	}

	if !known {
		return raw, ""
	}
	return canonical, strings.ReplaceAll(m[versionSuffix.SubexpIndex("version1")], "-", ".")
}
