package interceptor

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/snyk/go-application-framework/pkg/mocks"

	"github.com/elazarl/goproxy"
	"github.com/stretchr/testify/assert"
)

func TestLegacyFeatureFlagInterceptor_HandlesFeatureFlagPath(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	configMock := mocks.NewMockConfiguration(ctrl)
	configMock.EXPECT().
		GetBool(FeatureFlagShowMavenBuildScope).
		Return(true).
		AnyTimes()

	invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
	invocationCtxMock.EXPECT().
		GetConfiguration().
		Return(configMock).
		AnyTimes()

	legacyFeatureFlagInterceptor := NewLegacyFeatureFlagInterceptor(invocationCtxMock)
	handler := legacyFeatureFlagInterceptor.GetHandler()

	req := httptest.NewRequest(http.MethodGet, "https://example.com/cli-config/feature-flags/show-maven-build-scope?org=abc", nil)
	proxyCtx := &goproxy.ProxyCtx{}

	assert.True(t, legacyFeatureFlagInterceptor.GetCondition().HandleReq(req, proxyCtx), "condition should match feature flag path")

	_, resp := handler(req, proxyCtx)
	assert.NotNil(t, resp)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))

	bodyBytes, err := io.ReadAll(resp.Body)
	assert.NoError(t, err)

	var parsed featureFlagResponse
	assert.NoError(t, json.Unmarshal(bodyBytes, &parsed))
	assert.Equal(t, true, parsed.OK)
}

func TestLegacyFeatureFlagInterceptor_DoesNotHandleOtherPaths(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	configMock := mocks.NewMockConfiguration(ctrl)
	configMock.EXPECT().
		GetBool(FeatureFlagShowMavenBuildScope).
		Return(true).
		AnyTimes()

	invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
	invocationCtxMock.EXPECT().
		GetConfiguration().
		Return(configMock).
		AnyTimes()

	legacyFeatureFlagInterceptor := NewLegacyFeatureFlagInterceptor(invocationCtxMock)

	req := httptest.NewRequest(http.MethodGet, "https://example.com/api/v1/other-endpoint", nil)
	proxyCtx := &goproxy.ProxyCtx{}

	assert.False(t, legacyFeatureFlagInterceptor.GetCondition().HandleReq(req, proxyCtx), "condition should not match non-feature-flag path")
}
