package core

import (
	"bytes"
	"errors"
	"testing"

	"github.com/rs/zerolog"
	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/runtimeinfo"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/stretchr/testify/assert"
)

func writeLogHeaderWithMachineID(t *testing.T, id string, err error) string {
	t.Helper()
	config := configuration.NewWithOpts()
	config.AddDefaultValue(configuration.MACHINE_ID, func(configuration.Configuration, any) (any, error) {
		return id, err
	})
	engine := workflow.NewWorkFlowEngine(config)
	engine.SetRuntimeInfo(runtimeinfo.New())

	var out bytes.Buffer
	logger := zerolog.New(&out)
	r := newTestRun()
	r.logger = &logger
	r.config = config
	r.engine = engine

	r.writeLogHeader()
	return out.String()
}

func Test_writeLogHeader_showsInteractionIdOfTheRun(t *testing.T) {
	config := configuration.NewWithOpts()
	engine := workflow.NewWorkFlowEngine(config)
	engine.SetRuntimeInfo(runtimeinfo.New())

	var out bytes.Buffer
	logger := zerolog.New(&out)
	r := newTestRun()
	r.logger, r.config, r.engine = &logger, config, engine
	r.interactionId = "run-1234"

	r.writeLogHeader()

	assert.Contains(t, out.String(), "Interaction:           run-1234")
}

func Test_writeLogHeader_showsMachineID(t *testing.T) {
	out := writeLogHeaderWithMachineID(t, "0b6b2f6e-7f3c-4f53-a9c4-2f0c6a2b1d10", nil)

	assert.Contains(t, out, "Machine ID:            0b6b2f6e-7f3c-4f53-a9c4-2f0c6a2b1d10")
}

func Test_writeLogHeader_showsMachineIDFileUnreadableNextToTheID(t *testing.T) {
	unreadable := cli.NewMachineIDFileUnreadableError("The machine-scope shared machine id file at /etc/snyk/machine-id.json could not be read: permission denied")

	out := writeLogHeaderWithMachineID(t, "0b6b2f6e-7f3c-4f53-a9c4-2f0c6a2b1d10", unreadable)

	assert.Contains(t, out, "Machine ID:            0b6b2f6e-7f3c-4f53-a9c4-2f0c6a2b1d10")
	assert.Contains(t, out, "  Error:               SNYK-CLI-0030 Machine ID file unreadable: The machine-scope shared machine id file at /etc/snyk/machine-id.json could not be read: permission denied")
}

func Test_writeLogHeader_showsMachineIDUnavailableWithEveryReason(t *testing.T) {
	unreadable := cli.NewMachineIDFileUnreadableError("The user-scope shared machine id file at /home/u/.snyk/machine-id.json could not be read: permission denied")
	notPersisted := cli.NewMachineIDNotPersistedError("No machine id could be stored: permission denied")

	out := writeLogHeaderWithMachineID(t, "", errors.Join(runtimeinfo.ErrNoMachineID, errors.Join(unreadable, notPersisted)))

	assert.Contains(t, out, "Machine ID:            unavailable")
	assert.Contains(t, out, "  Error:               SNYK-CLI-0030 Machine ID file unreadable: The user-scope shared machine id file at /home/u/.snyk/machine-id.json could not be read: permission denied")
	assert.Contains(t, out, "  Error:               SNYK-CLI-0031 Machine ID not persisted: No machine id could be stored: permission denied")
	assert.NotContains(t, out, runtimeinfo.ErrNoMachineID.Error())
}

func Test_writeLogHeader_showsMessageOfNonCatalogMachineIDError(t *testing.T) {
	out := writeLogHeaderWithMachineID(t, "", errors.New("machine id storage is broken"))

	assert.Contains(t, out, "Machine ID:            unavailable")
	assert.Contains(t, out, "  Error:               failed to read machine id: machine id storage is broken")
}

func Test_writeLogHeader_keepsEachMachineIDErrorOnOneLine(t *testing.T) {
	notPersisted := cli.NewMachineIDNotPersistedError("No machine id could be stored: locking /etc/snyk/machine-id.json.lock: permission denied\nopen /home/u/.snyk/machine-id.json: permission denied")

	out := writeLogHeaderWithMachineID(t, "", errors.Join(runtimeinfo.ErrNoMachineID, notPersisted))

	assert.Contains(t, out, "  Error:               SNYK-CLI-0031 Machine ID not persisted: No machine id could be stored: locking /etc/snyk/machine-id.json.lock: permission denied; open /home/u/.snyk/machine-id.json: permission denied")
}
