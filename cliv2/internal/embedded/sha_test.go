package embedded

import (
	"github.com/stretchr/testify/assert"
	"log"
	"os"
	"path"
	"strings"
	"testing"
)

func Test_ValidateFile(t *testing.T) {
	testfile := path.Join(t.TempDir(), "file")
	err := os.WriteFile(testfile, []byte("snyk\n"), 0644)
	assert.Nil(t, err)

	expectedSha := strings.ToUpper(" 504515e17a93f438519f45a9e32bbeef7ca697f9f626ed22e0ac258cccc7e99e ")
	result, err := ValidateFile(testfile, expectedSha, log.Default())
	assert.Nil(t, err)
	assert.True(t, result)
}

func Test_ValidateFile_Fail(t *testing.T) {
	testfile := path.Join(t.TempDir(), "file")
	err := os.WriteFile(testfile, []byte("snyk\n"), 0644)
	assert.Nil(t, err)

	expectedSha := "blblbla"
	result, err := ValidateFile(testfile, expectedSha, log.Default())
	assert.Nil(t, err)
	assert.False(t, result)
}
