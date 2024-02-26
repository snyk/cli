package basic_workflows

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_finalizeArguments(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := finalizeArguments([]string{"a", "b", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_finalizeArguments_doubleDashNotAppend(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "x"}
	actual := finalizeArguments([]string{"a", "b", "c", "--", "x"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_finalizeArguments_(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := finalizeArguments([]string{"a", "b", "--proxy-noauth", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}
