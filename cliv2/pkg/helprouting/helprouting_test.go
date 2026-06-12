package helprouting

import (
	"bytes"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/pkg/helpdocs"
)

func Test_Router_Help(t *testing.T) {
	root := setupTestRoot(t)

	type testStruct struct {
		name       string
		argv       []string
		command    func(t *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer)
		wantLegacy bool
		cobraOut   []string
	}

	documented := []testStruct{
		{
			name: "top-level --help uses legacy readme",
			argv: []string{"--help"},
			command: func(_ *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return root, nil
			},
			wantLegacy: true,
		},
		{
			name: "help subcommand uses legacy",
			argv: []string{"help"},
			command: func(_ *testing.T, _ *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return helpSubcommand(), nil
			},
			wantLegacy: true,
		},
		{
			name: "help test uses legacy user doc",
			argv: []string{"help", "test"},
			command: func(_ *testing.T, _ *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return helpSubcommand(), nil
			},
			wantLegacy: true,
		},
		{
			name: "documented test --help uses legacy",
			argv: []string{"test", "--help"},
			command: func(_ *testing.T, _ *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return nil, nil
			},
			wantLegacy: true,
		},
		{
			name: "unknown command --help falls back to legacy",
			argv: []string{"rainmaker", "--help"},
			command: func(_ *testing.T, _ *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return nil, nil
			},
			wantLegacy: true,
		},
		{
			name: "-h container uses legacy user doc",
			argv: []string{"-h", "container"},
			command: func(_ *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return root, nil
			},
			wantLegacy: true,
		},
		{
			name: "iac -help uses legacy user doc",
			argv: []string{"iac", "-help"},
			command: func(_ *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return root, nil
			},
			wantLegacy: true,
		},
		{
			name: "--help=iac uses legacy user doc",
			argv: []string{"--help=iac"},
			command: func(_ *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return root, nil
			},
			wantLegacy: true,
		},
		{
			name: "--help hello uses legacy readme",
			argv: []string{"--help", "hello"},
			command: func(_ *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				return root, nil
			},
			wantLegacy: true,
		},
	}

	undocumented := []testStruct{
		{
			name: "undocumented secrets test --help uses cobra",
			argv: []string{"secrets", "test", "--help"},
			command: func(t *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				t.Helper()
				cmd := findCommand(t, root, "secrets", "test")
				buf := &bytes.Buffer{}
				cmd.SetOut(buf)
				return cmd, buf
			},
			cobraOut: []string{"Usage:"},
		},
		{
			name: "unknown flag on undocumented command uses cobra",
			argv: []string{"secrets", "test", "--bad-flag"},
			command: func(t *testing.T, root *cobra.Command) (*cobra.Command, *bytes.Buffer) {
				t.Helper()
				cmd := findCommand(t, root, "secrets", "test")
				buf := &bytes.Buffer{}
				cmd.SetOut(buf)
				return cmd, buf
			},
			cobraOut: []string{"Usage:"},
		},
	}

	for _, tc := range append(documented, undocumented...) {
		t.Run(tc.name, func(t *testing.T) {
			legacyCalled := false
			router := &Router{
				LegacyHelp: func() error {
					legacyCalled = true
					return nil
				},
			}

			cmd, buf := tc.command(t, root)
			err := router.Help(cmd, root, tc.argv)
			require.NoError(t, err)
			assert.Equal(t, tc.wantLegacy, legacyCalled, "legacy help routing")
			if tc.wantLegacy {
				return
			}
			require.NotNil(t, buf)
			for _, want := range tc.cobraOut {
				assert.Contains(t, buf.String(), want)
			}
		})
	}
}

func Test_targetArgs(t *testing.T) {
	assert.Equal(t, []string{"secrets", "test"}, targetArgs([]string{"secrets", "test", "--help"}))
	assert.Equal(t, []string{"secrets", "test"}, targetArgs([]string{"secrets", "test", "--bad-flag"}))
	assert.Equal(t, []string{"help", "test"}, targetArgs([]string{"help", "test"}))
}

func Test_commandSegmentsFromCobra(t *testing.T) {
	root := setupTestRoot(t)
	cmd := findCommand(t, root, "secrets", "test")
	assert.Equal(t, []string{"secrets", "test"}, commandSegmentsFromCobra(cmd))
}

func Test_commandSegments(t *testing.T) {
	root := setupTestRoot(t)

	assert.Equal(t, []string{"container"}, commandSegments(root, root, []string{"-h", "container"}))
	assert.True(t, helpdocs.HasUserDoc([]string{"container"}))

	assert.Equal(t, []string{"container"}, commandSegments(root, root, []string{"--help=container"}))
}

func Test_resolveCobraTarget(t *testing.T) {
	root := setupTestRoot(t)
	helpCmd := &cobra.Command{Use: "help"}
	secretsTestCmd := findCommand(t, root, "secrets", "test")

	assert.Nil(t, resolveCobraTarget(helpCmd, root, []string{"help", "hello"}))
	assert.Equal(t, secretsTestCmd, resolveCobraTarget(secretsTestCmd, root, []string{"secrets", "test", "--help"}))
	assert.Equal(t, secretsTestCmd, resolveCobraTarget(helpCmd, root, []string{"help", "secrets", "test"}))
}

func Test_renderCobraHelpToBuffer(t *testing.T) {
	cmd := &cobra.Command{
		Use:   "test",
		Short: "Scan for secrets",
		RunE: func(_ *cobra.Command, _ []string) error {
			return nil
		},
	}
	cmd.Flags().String("org", "", "Organization ID")

	output, err := renderCobraHelpToBuffer(cmd)
	require.NoError(t, err)
	assert.Contains(t, output, "Usage:")
	assert.Contains(t, output, "Flags:")
	assert.Contains(t, output, "--org")
}

func setupTestRoot(t *testing.T) *cobra.Command {
	t.Helper()

	root := &cobra.Command{Use: "snyk"}
	secrets := &cobra.Command{Use: "secrets"}
	test := &cobra.Command{
		Use: "test",
		RunE: func(_ *cobra.Command, _ []string) error {
			return nil
		},
	}
	secrets.AddCommand(test)
	root.AddCommand(secrets)
	return root
}

func findCommand(t *testing.T, root *cobra.Command, path ...string) *cobra.Command {
	t.Helper()

	cmd, _, err := root.Find(path)
	require.NoError(t, err)
	return cmd
}

func helpSubcommand() *cobra.Command {
	return &cobra.Command{Use: "help"}
}
