package core

import (
	"os"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"
	"github.com/snyk/go-application-framework/pkg/ui"

	debug_tools "github.com/snyk/cli/cliv2/internal/debug"
)

var buildType string = ""

const WARNING_MESSAGE = "⚠️ WARNING: Potentially Sensitive Information ⚠️\nThese logs may contain sensitive data, including secrets or passwords. Snyk applies automated safeguards to redact commonly recognized secrets; however, full coverage cannot be guaranteed. We strongly recommend that you carefully review the logs before sharing to ensure no confidential or proprietary information is included."

// refreshableScrubbingWriter swaps the scrubber when CLI-derived terms become available.
type refreshableScrubbingWriter struct {
	out     zerolog.LevelWriter
	mu      sync.Mutex
	current zerolog.LevelWriter
}

func newRefreshableScrubbingWriter(out zerolog.LevelWriter, config configuration.Configuration) *refreshableScrubbingWriter {
	return &refreshableScrubbingWriter{
		out:     out,
		current: logging.NewScrubbingWriter(out, logging.GetScrubDictFromConfig(config)),
	}
}

func (w *refreshableScrubbingWriter) Refresh(config configuration.Configuration) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.current = logging.NewScrubbingWriter(w.out, logging.GetScrubDictFromConfig(config))
}

func (w *refreshableScrubbingWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.current.Write(p)
}

func (w *refreshableScrubbingWriter) WriteLevel(level zerolog.Level, p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.current.WriteLevel(level, p)
}

func initDebugLogger(config configuration.Configuration) (*zerolog.Logger, *refreshableScrubbingWriter) {
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

	scrubLogger := newRefreshableScrubbingWriter(zerolog.MultiLevelWriter(consoleWriter), config)

	localLogger := zerolog.New(scrubLogger).With().Str("ext", "main").Str("separator", "-").Timestamp().Logger()
	loglevel := debug_tools.GetDebugLevel(config)
	debugLogger := localLogger.Level(loglevel)
	debugLogger.Log().Msg(WARNING_MESSAGE)
	debugLogger.Log().Msgf("Using log level: %s", loglevel)
	return &debugLogger, scrubLogger
}

func initDebugBuild() {
	if strings.EqualFold(buildType, "debug") {
		progress := ui.DefaultUi().NewProgressBar()
		progress.SetTitle("Pausing execution to attach the debugger!")
		waitTimeInSeconds := 10

		for i := range waitTimeInSeconds {
			value := float64(waitTimeInSeconds-i) / float64(waitTimeInSeconds)
			_ = progress.UpdateProgress(value)
			time.Sleep(1 * time.Second)
		}
		_ = progress.Clear()
	}
}
