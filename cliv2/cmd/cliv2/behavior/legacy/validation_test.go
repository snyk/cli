package legacy

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_validateIncompatibleFlagCombinations(t *testing.T) {
	tests := []struct {
		args    []string
		wantErr string
	}{
		{[]string{"test", "--all-projects"}, ""},
		{[]string{"test"}, ""},
		{[]string{"test", "--all-projects", "--severity-threshold=high"}, ""},
		{[]string{"test", "--file", "--project-name"}, ""},
		{[]string{}, ""},
		{[]string{"test", "--file", "--all-projects"}, "file + all-projects"},
		{[]string{"test", "--file=package.json", "--all-projects"}, "file + all-projects"},
		{[]string{"test", "--package-manager", "--all-projects"}, "package-manager + all-projects"},
		{[]string{"test", "--package-manager=npm", "--all-projects"}, "package-manager + all-projects"},
		{[]string{"test", "--project-name", "--all-projects"}, "project-name + all-projects"},
		{[]string{"test", "--docker", "--all-projects"}, "docker + all-projects"},
		{[]string{"test", "--all-sub-projects", "--all-projects"}, "all-sub-projects + all-projects"},
		{[]string{"test", "--yarn-workspaces", "--all-projects"}, "yarn-workspaces + all-projects"},
		{[]string{"test", "--all-projects", "--file"}, "file + all-projects"},
		{[]string{"test", "--yarn-workspaces", "--file"}, "file + yarn-workspaces"},
		{[]string{"test", "--scan-all-unmanaged", "--file"}, "file + scan-all-unmanaged"},
		{[]string{"test", "--maven-aggregate-project", "--project-name"}, "project-name + maven-aggregate-project"},
	}

	for _, tt := range tests {
		err := validateFlagsCompatibilityWithLegacy(tt.args)
		if tt.wantErr == "" {
			assert.NoError(t, err, "args: %v", tt.args)
		} else {
			assert.EqualError(t, err, "The following option combination is not currently supported: "+tt.wantErr, "args: %v", tt.args)
		}
	}
}

func Test_parseFlagsFromArgs(t *testing.T) {
	tests := []struct {
		name string
		args []string
		want map[string]bool
	}{
		{
			name: "multiple flags without values",
			args: []string{"test", "--file", "--all-projects"},
			want: map[string]bool{"--file": true, "--all-projects": true},
		},
		{
			name: "flag with value",
			args: []string{"test", "--file=package.json", "--severity-threshold=high"},
			want: map[string]bool{"--file": true, "--severity-threshold": true},
		},
		{
			name: "no flags",
			args: []string{"test"},
			want: map[string]bool{},
		},
		{
			name: "empty args",
			args: []string{},
			want: map[string]bool{},
		},
		{
			name: "mixed flags and positional args",
			args: []string{"test", "--file", "path/to/file", "--all-projects"},
			want: map[string]bool{"--file": true, "--all-projects": true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseFlagsFromArgs(tt.args)
			assert.Equal(t, tt.want, got, "args: %v", tt.args)
		})
	}
}

func Test_extractFlagName(t *testing.T) {
	tests := []struct {
		flag string
		want string
	}{
		{"--file", "file"},
		{"--all-projects", "all-projects"},
		{"--severity-threshold", "severity-threshold"},
		{"file", "file"},
	}

	for _, tt := range tests {
		assert.Equal(t, tt.want, extractFlagName(tt.flag))
	}
}
