package helprouting

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/snyk/cli/cliv2/internal/helpdocs"
	"github.com/spf13/cobra"
)

const (
	helpCommand = "help"
	helpFlag    = "--help"
)

var defaultCobraHelpFunc func(*cobra.Command, []string)

func init() {
	defaultCobraHelpFunc = (&cobra.Command{}).HelpFunc()
}

// Router decides whether to show legacy user-doc help or Cobra help.
type Router struct {
	LegacyHelp   func() error
	OnHelpCalled func()
}

// Help picks legacy user-doc help or Cobra help for the given context.
// argv is typically os.Args[1:] (without the binary name). When c is nil,
// command context is derived from argv and root (flag-error path).
func (r *Router) Help(c *cobra.Command, root *cobra.Command, argv []string) error {
	if r.OnHelpCalled != nil {
		r.OnHelpCalled()
	}

	if root == nil && c != nil {
		root = c.Root()
	}
	if c == nil && root != nil {
		c = resolveHelpCommand(root, argv)
	}

	segments := commandSegments(c, root, argv)
	if helpdocs.HasUserDoc(segments) {
		return r.LegacyHelp()
	}

	target := resolveCobraTarget(c, root, argv)
	if target == nil {
		return r.LegacyHelp()
	}

	if helpdocs.HasUserDoc(commandSegmentsFromCobra(target)) {
		return r.LegacyHelp()
	}

	return renderCobraHelp(target)
}

func commandSegments(c *cobra.Command, root *cobra.Command, argv []string) []string {
	if root == nil {
		return commandSegmentsFromCobra(c)
	}

	args := pathArgs(argv)
	if len(args) == 0 {
		return commandSegmentsFromCobra(c)
	}
	if cmd, _, err := root.Find(args); err == nil && cmd != nil && cmd != root {
		return commandSegmentsFromCobra(cmd)
	}
	return args
}

func resolveCobraTarget(c *cobra.Command, root *cobra.Command, argv []string) *cobra.Command {
	if root == nil {
		return nil
	}

	args := pathArgs(argv)
	if len(args) > 0 {
		cmd, _, err := root.Find(args)
		if err == nil && cmd != nil && cmd != root && cmd.Name() != helpCommand {
			return cmd
		}
		return nil
	}

	if c != nil && c != root && c.Name() != helpCommand {
		return c
	}

	return nil
}

func resolveHelpCommand(root *cobra.Command, argv []string) *cobra.Command {
	if root == nil {
		return nil
	}
	args := targetArgs(argv)
	if len(args) == 0 {
		return nil
	}
	cmd, _, err := root.Find(args)
	if err != nil {
		return nil
	}
	return cmd
}

func commandSegmentsFromCobra(cmd *cobra.Command) []string {
	if cmd == nil {
		return nil
	}
	root := cmd.Root()
	if cmd == root || cmd.Name() == helpCommand {
		return nil
	}
	var segments []string
	for cur := cmd; cur != nil && cur != root; cur = cur.Parent() {
		if cur.Name() == helpCommand {
			continue
		}
		segments = append([]string{cur.Name()}, segments...)
	}
	return segments
}

// pathArgs returns command path tokens from argv, stripping help flags and a leading "help" subcommand.
func pathArgs(argv []string) []string {
	args := targetArgs(argv)
	if len(args) > 0 && args[0] == helpCommand {
		return args[1:]
	}
	return args
}

func targetArgs(argv []string) []string {
	var out []string
	for _, arg := range argv {
		if isHelpFlag(arg) {
			continue
		}
		if strings.HasPrefix(arg, fmt.Sprintf("%s=", helpFlag)) {
			out = append(out, strings.TrimPrefix(arg, fmt.Sprintf("%s=", helpFlag)))
			continue
		}
		if strings.HasPrefix(arg, "-") {
			continue
		}
		out = append(out, arg)
	}
	return out
}

func isHelpFlag(arg string) bool {
	return arg == helpFlag || arg == "-h" || arg == "-help"
}

func renderCobraHelp(cmd *cobra.Command) error {
	cmd.SetHelpFunc(defaultCobraHelpFunc)
	return cmd.Help()
}

func renderCobraHelpToBuffer(cmd *cobra.Command) (string, error) {
	var buf bytes.Buffer
	cmd.SetOut(&buf)
	err := renderCobraHelp(cmd)
	return buf.String(), err
}
