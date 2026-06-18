package interceptor

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/mocks"

	"github.com/elazarl/goproxy"
	"github.com/stretchr/testify/assert"
)

func TestLegacyFeatureFlagInterceptor_Routing(t *testing.T) {
	// The condition matches every /cli-config/feature-flags/<flag> URL; the
	// handler then decides whether to serve or pass through.
	cases := map[string]bool{
		"https://example.com/v1/cli-config/feature-flags/show-maven-build-scope?org=abc": true,
		"https://example.com/v1/cli-config/feature-flags/cliDotnetRuntimeResolution":     true,
		"https://example.com/v1/cli-config/feature-flags/someUnknownFlag":                true,
		"https://example.com/api/v1/other-endpoint":                                      false,
	}

	for path, shouldMatch := range cases {
		t.Run(path, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			i := NewLegacyFeatureFlagInterceptor(mocks.NewMockInvocationContext(ctrl))
			req := httptest.NewRequest(http.MethodGet, path, nil)
			assert.Equal(t, shouldMatch, i.GetCondition().HandleReq(req, &goproxy.ProxyCtx{}))
		})
	}
}

func TestLegacyFeatureFlagInterceptor_Handler(t *testing.T) {
	const base = "https://example.com/v1/cli-config/feature-flags/"
	tests := []struct {
		name         string
		path         string
		configKey    string // "" => handler should not read config
		configValue  bool
		configErr    error
		expectServed bool
		expectOK     bool
	}{
		{
			name:         "maven scope served from its override key",
			path:         base + "show-maven-build-scope?org=abc",
			configKey:    FeatureFlagShowMavenBuildScope,
			configValue:  true,
			expectServed: true,
			expectOK:     true,
		},
		{
			name:         "general flag served from its prefixed API-backed key",
			path:         base + "cliDotnetRuntimeResolution",
			configKey:    generalFeatureFlagConfigKey("cliDotnetRuntimeResolution"),
			configValue:  false,
			expectServed: true,
			expectOK:     false,
		},
		{
			name:         "resolution error passes through to network",
			path:         base + "cliDotnetRuntimeResolution",
			configKey:    generalFeatureFlagConfigKey("cliDotnetRuntimeResolution"),
			configErr:    assert.AnError,
			expectServed: false,
		},
		{
			name:         "unknown flag passes through to network",
			path:         base + "someUnknownFlag",
			expectServed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			configMock := mocks.NewMockConfiguration(ctrl)
			if tt.configKey != "" {
				configMock.EXPECT().
					GetBoolWithError(tt.configKey).
					Return(tt.configValue, tt.configErr).
					AnyTimes()
			}

			invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
			invocationCtxMock.EXPECT().GetConfiguration().Return(configMock).AnyTimes()
			logger := zerolog.Nop()
			invocationCtxMock.EXPECT().GetEnhancedLogger().Return(&logger).AnyTimes()

			handler := NewLegacyFeatureFlagInterceptor(invocationCtxMock).GetHandler()
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			_, resp := handler(req, &goproxy.ProxyCtx{})

			if !tt.expectServed {
				assert.Nil(t, resp)
				return
			}

			assert.NotNil(t, resp)
			defer func() { _ = resp.Body.Close() }()
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))

			body, err := io.ReadAll(resp.Body)
			assert.NoError(t, err)
			var parsed featureFlagResponse
			assert.NoError(t, json.Unmarshal(body, &parsed))
			assert.Equal(t, tt.expectOK, parsed.OK)
		})
	}
}
