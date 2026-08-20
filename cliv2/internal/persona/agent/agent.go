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

// versionSuffix recognises a version-shaped run of digits at the end of a
// Harness identifier, with an optional trailing role/surface segment that is
// captured only so it isn't absorbed into the version, then discarded. '_',
// '/', and '@' are all accepted as separators: '_' and '/' cover Snyk's own
// fused and legacy formats, '@' covers detect-agent's documented
// name@version convention for custom AI_AGENT declarations. Requiring at
// least two numeric components avoids matching a name that merely ends in a
// single digit.
var versionSuffix = regexp.MustCompile(`^(?P<name>.+?)[_/@](?P<version>\d+(?:[.\-]\d+){1,3})(?:[_/@](?P<role>[A-Za-z0-9-]+))?$`)

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

// SplitVersion splits a version-shaped suffix off a raw Harness identifier
// and canonicalises the remaining name fragment against detect-agent's known
// vocabulary. It returns the identifier unchanged with an empty version when
// no version-shaped suffix is present, or when the extracted fragment does
// not resolve to a known Harness — never a guess.
func SplitVersion(raw string) (name string, version string) {
	m := versionSuffix.FindStringSubmatch(raw)
	if m == nil {
		return raw, ""
	}

	fragment := m[versionSuffix.SubexpIndex("name")]
	canonical, ok := knownNames[normalize(fragment)]
	if !ok {
		return raw, ""
	}

	return canonical, strings.ReplaceAll(m[versionSuffix.SubexpIndex("version")], "-", ".")
}
