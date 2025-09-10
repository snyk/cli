package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"
	"github.com/snyk/go-application-framework/pkg/ui"

	debug_tools "github.com/snyk/cli/cliv2/internal/debug"
)

var buildType string = ""

const WARNING_MESSAGE = "⚠️ WARNING: Potentially Sensitive Information ⚠️\nThese logs may contain sensitive data, including secrets or passwords. Snyk applies automated safeguards to redact commonly recognized secrets; however, full coverage cannot be guaranteed. We strongly recommend that you carefully review the logs before sharing to ensure no confidential or proprietary information is included."

func initDebugLogger(config configuration.Configuration) *zerolog.Logger {
	var consoleWriter = zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: time.RFC3339,
		NoColor:    true,
		PartsOrder: []string{
			zerolog.TimestampFieldName,
			"ext",
			"separator",
			zerolog.CallerFieldName,
			zerolog.MessageFieldName,
		},
		FieldsExclude: []string{"ext", "separator"},
		FormatTimestamp: func(i interface{}) string {
			timeString, ok := i.(string)
			if !ok {
				return ""
			}
			t, err := time.Parse(time.RFC3339, timeString)
			if err != nil {
				return ""
			}
			return strings.ToUpper(t.UTC().Format(time.RFC3339))
		},
	}

	scrubLogger := logging.NewScrubbingWriter(zerolog.MultiLevelWriter(consoleWriter), logging.GetScrubDictFromConfig(config))
	localLogger := zerolog.New(scrubLogger).With().Str("ext", "main").Str("separator", "-").Timestamp().Logger()
	loglevel := debug_tools.GetDebugLevel(config)
	debugLogger := localLogger.Level(loglevel)
	debugLogger.Log().Msg(WARNING_MESSAGE)
	debugLogger.Log().Msgf("Using log level: %s", loglevel)
	return &debugLogger
}

func initDebugBuild() {
	if strings.EqualFold(buildType, "debug") {
		progress := ui.DefaultUi().NewProgressBar()
		progress.SetTitle("Pausing execution to attach the debugger!")
		waitTimeInSeconds := 10

		for i := range waitTimeInSeconds {
			value := float64(waitTimeInSeconds-i) / float64(waitTimeInSeconds)
			progress.UpdateProgress(value)
			time.Sleep(1 * time.Second)
		}
		progress.Clear()
	}
}
