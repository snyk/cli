package core

import (
	"context"
	"errors"
	"io"

	"github.com/snyk/go-application-framework/pkg/ui"
	"github.com/snyk/go-application-framework/pkg/ui/consoleui"
	"github.com/snyk/go-application-framework/pkg/ui/uitypes"
	"github.com/spf13/cobra"

	"github.com/snyk/cli/cliv2/internal/cliv2"
)

func isVersionRequest(args []string) bool {
	cmd := &cobra.Command{}
	cmd.FParseErrWhitelist.UnknownFlags = true
	cmd.Flags().SetInterspersed(false)
	cmd.Flags().AddFlagSet(getGlobalFLags())
	version := cmd.Flags().BoolP("version", "v", false, "")
	help := cmd.Flags().BoolP("help", "h", false, "")

	if err := cmd.ParseFlags(args); err != nil || *help {
		return false
	}

	return *version || cmd.Flags().Arg(0) == "version"
}

func runVersionCommand(ctx context.Context, args []string, stdout io.Writer) int {
	err := cliv2.CommandVersion(args, stdout)
	if err != nil {
		err = decorateError(err)
		ctx = context.WithValue(ctx, uitypes.ErrorTipKey, doctorTip(false))
		uiErr := consoleui.New(consoleui.WithErrorOutput(stdout)).OutputError(err, ui.WithContext(ctx))
		err = errors.Join(err, uiErr)
	}
	return cliv2.DeriveExitCode(err)
}
