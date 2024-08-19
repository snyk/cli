package basic_workflows

import (
	"github.com/snyk/go-application-framework/pkg/workflow"
)

func Init(engine workflow.Engine) error {
	err := initLegacycli(engine)
	if err != nil {
		return err
	}

	err = initCleanup(engine)
	if err != nil {
		return err
	}

	return nil
}
