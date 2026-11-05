// Package userjourney holds in-process journeys of the lifecycle commands install and uninstall. The steps are
// extension-provided workflows labeled with a lifecycle, so they can only be registered in process.
package userjourney

import (
	"errors"
	"io"
	"os"
	"sync"
	"testing"

	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/go-application-framework/pkg/catalog"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/pkg/core"
)

// stepOutcome is what a step does when it runs.
type stepOutcome func() ([]workflow.Data, error)

func succeeds() ([]workflow.Data, error) { return nil, nil }

func fails(message string) stepOutcome {
	return func() ([]workflow.Data, error) { return nil, errors.New(message) }
}

func panics() stepOutcome {
	return func() ([]workflow.Data, error) { panic("step panicked") }
}

func returnsData(payload string) stepOutcome {
	return func() ([]workflow.Data, error) {
		id := workflow.NewTypeIdentifier(workflow.NewWorkflowIdentifier("step-output"), "marker")
		return []workflow.Data{workflow.NewData(id, "text/plain", payload)}, nil
	}
}

// stepRecorder records the IDs of the steps that ran.
type stepRecorder struct {
	mu  sync.Mutex
	ran []string
}

func (s *stepRecorder) record(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ran = append(s.ran, id)
}

func (s *stepRecorder) steps() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string{}, s.ran...)
}

func (s *stepRecorder) callback(id string, outcome stepOutcome) workflow.Callback {
	return func(workflow.InvocationContext, []workflow.Data) ([]workflow.Data, error) {
		s.record(id)
		return outcome()
	}
}

// installStep registers a step labeled lifecycle=install.
func installStep(rec *stepRecorder, id string, outcome stepOutcome) workflow.ExtensionInit {
	return func(engine workflow.Engine) error {
		config := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet(id, pflag.ContinueOnError))
		_, err := catalog.Register(engine, workflow.NewWorkflowIdentifier(id), config, rec.callback(id, outcome), catalog.WithLifecycle(catalog.Install))
		return err
	}
}

// uninstallStep registers a step labeled lifecycle=uninstall.
func uninstallStep(rec *stepRecorder, id string, outcome stepOutcome) workflow.ExtensionInit {
	return func(engine workflow.Engine) error {
		config := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet(id, pflag.ContinueOnError))
		_, err := catalog.Register(engine, workflow.NewWorkflowIdentifier(id), config, rec.callback(id, outcome), catalog.WithLifecycle(catalog.Uninstall))
		return err
	}
}

// captureOutput runs the function with stdout and stderr redirected to a pipe and returns its exit code and what it
// printed. The streams are restored even when the function panics, so the panic cannot leave later tests without output.
func captureOutput(t *testing.T, run func() int) (int, string) {
	t.Helper()
	reader, writer, err := os.Pipe()
	require.NoError(t, err)
	defer func() { _ = reader.Close() }()

	output := make(chan string, 1)
	go func() {
		out, _ := io.ReadAll(reader)
		output <- string(out)
	}()

	oldStdout, oldStderr := os.Stdout, os.Stderr
	os.Stdout, os.Stderr = writer, writer
	exitCode := func() int {
		defer func() {
			os.Stdout, os.Stderr = oldStdout, oldStderr
			_ = writer.Close()
		}()
		return run()
	}()
	return exitCode, <-output
}

// runCLI runs the CLI in process with the extensions and the arguments. It returns the exit code and everything the run
// printed. The run is isolated from the configuration of the developer and from analytics.
func runCLI(t *testing.T, exts []workflow.ExtensionInit, args ...string) (int, string) {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	t.Setenv("SNYK_DISABLE_ANALYTICS", "1")

	oldArgs := append([]string{}, os.Args...)
	os.Args = append([]string{"snyk"}, args...)
	defer func() { os.Args = oldArgs }()

	return captureOutput(t, func() int {
		return core.Run(core.WithAdditionalExtensions(exts...))
	})
}

func Test_install_runsEveryInstallStep(t *testing.T) {
	rec := &stepRecorder{}

	exitCode, out := runCLI(t, []workflow.ExtensionInit{
		installStep(rec, "install-step-a", succeeds),
		installStep(rec, "install-step-b", succeeds),
	}, "install")

	assert.Equal(t, 0, exitCode, out)
	assert.ElementsMatch(t, []string{"install-step-a", "install-step-b"}, rec.steps())
}

func Test_install_runsStepsInIdOrder(t *testing.T) {
	rec := &stepRecorder{}

	_, _ = runCLI(t, []workflow.ExtensionInit{
		installStep(rec, "install-step-b", succeeds),
		installStep(rec, "install-step-a", succeeds),
	}, "install")

	assert.Equal(t, []string{"install-step-a", "install-step-b"}, rec.steps())
}

func Test_install_failingStepDoesNotStopTheOtherSteps(t *testing.T) {
	rec := &stepRecorder{}

	exitCode, out := runCLI(t, []workflow.ExtensionInit{
		installStep(rec, "install-step-a", fails("disk is full")),
		installStep(rec, "install-step-b", succeeds),
	}, "install")

	assert.NotEqual(t, 0, exitCode)
	assert.ElementsMatch(t, []string{"install-step-a", "install-step-b"}, rec.steps())
	// the error lists the failed step and its message in its details
	// TODO(CLI-2044): assert the error-catalog code and title, and one details entry per failed step, once the error is released.
	assert.Contains(t, out, "install-step-a")
	assert.Contains(t, out, "disk is full")
}

func Test_install_panickingStepDoesNotStopTheOtherSteps(t *testing.T) {
	rec := &stepRecorder{}

	exitCode, out := runCLI(t, []workflow.ExtensionInit{
		installStep(rec, "install-step-a", panics()),
		installStep(rec, "install-step-b", succeeds),
	}, "install")

	assert.NotEqual(t, 0, exitCode)
	assert.ElementsMatch(t, []string{"install-step-a", "install-step-b"}, rec.steps())
	assert.Contains(t, out, "install-step-a")
	// a stack trace is never shown to the user
	assert.NotContains(t, out, "goroutine ")
}

// Test_install_stepThatInvokesInstallDoesNotRecurse: a step labeled lifecycle=install that invokes install again does
// not run again. The pitch says install skips itself to prevent recursion. The re-entry semantics are not defined by
// the pitch, see the open questions. A second run of the step returns an error, so a missing guard fails the assertion
// instead of recursing without end.
func Test_install_stepThatInvokesInstallDoesNotRecurse(t *testing.T) {
	rec := &stepRecorder{}
	reentrant := func(engine workflow.Engine) error {
		config := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("install-reentrant", pflag.ContinueOnError))
		callback := func(workflow.InvocationContext, []workflow.Data) ([]workflow.Data, error) {
			rec.record("install-reentrant")
			if len(rec.steps()) > 1 {
				return nil, errors.New("step ran again")
			}
			return engine.Invoke(workflow.NewWorkflowIdentifier("install"))
		}
		_, err := catalog.Register(engine, workflow.NewWorkflowIdentifier("install-reentrant"), config, callback, catalog.WithLifecycle(catalog.Install))
		return err
	}

	_, _ = runCLI(t, []workflow.ExtensionInit{reentrant}, "install")

	assert.Equal(t, []string{"install-reentrant"}, rec.steps())
}

func Test_install_dropsTheDataReturnedByAStep(t *testing.T) {
	rec := &stepRecorder{}

	exitCode, out := runCLI(t, []workflow.ExtensionInit{
		installStep(rec, "install-step-a", returnsData("STEP-OUTPUT-MARKER")),
	}, "install")

	assert.Equal(t, 0, exitCode, out)
	assert.NotContains(t, out, "STEP-OUTPUT-MARKER")
}

func Test_install_withoutStepsSucceeds(t *testing.T) {
	exitCode, out := runCLI(t, nil, "install")

	assert.Equal(t, 0, exitCode, out)
}

func Test_uninstall_runsOnlyUninstallSteps(t *testing.T) {
	rec := &stepRecorder{}

	exitCode, out := runCLI(t, []workflow.ExtensionInit{
		installStep(rec, "install-step-a", succeeds),
		uninstallStep(rec, "uninstall-step-a", succeeds),
		uninstallStep(rec, "uninstall-step-b", succeeds),
	}, "uninstall")

	assert.Equal(t, 0, exitCode, out)
	assert.ElementsMatch(t, []string{"uninstall-step-a", "uninstall-step-b"}, rec.steps())
}

func Test_uninstall_failingStepIsReported(t *testing.T) {
	rec := &stepRecorder{}

	exitCode, out := runCLI(t, []workflow.ExtensionInit{
		uninstallStep(rec, "uninstall-step-a", fails("still in use")),
		uninstallStep(rec, "uninstall-step-b", succeeds),
	}, "uninstall")

	assert.NotEqual(t, 0, exitCode)
	assert.ElementsMatch(t, []string{"uninstall-step-a", "uninstall-step-b"}, rec.steps())
	// TODO(CLI-2044): assert the error-catalog code and title, and one details entry per failed step, once the error is released.
	assert.Contains(t, out, "uninstall-step-a")
	assert.Contains(t, out, "still in use")
}

func Test_uninstall_withoutStepsSucceeds(t *testing.T) {
	exitCode, out := runCLI(t, nil, "uninstall")

	assert.Equal(t, 0, exitCode, out)
}
