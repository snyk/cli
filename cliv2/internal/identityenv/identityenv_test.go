package identityenv

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_Vars_Snapshot(t *testing.T) {
	assert.Equal(t, []string{
		"SNYK_TOKEN",
		"SNYK_CFG_API",
		"SNYK_OAUTH_TOKEN",
		"SNYK_DOCKER_TOKEN",
		"INTERNAL_OAUTH_TOKEN_STORAGE",
		"INTERNAL_MACHINE_IDENTITY_STORAGE",
		"INTERNAL_NEW_SNYK_TOKEN",
	}, Vars())
}
