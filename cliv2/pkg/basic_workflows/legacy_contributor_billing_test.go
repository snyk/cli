package basic_workflows

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/contributorbilling"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/networking/contributorcapture"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_emitLegacyContributorBilling_EmitsPerCapturedProject(t *testing.T) {
	t.Parallel()

	var (
		mu       sync.Mutex
		requests []map[string]any
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var payload map[string]any
		require.NoError(t, json.Unmarshal(body, &payload))

		mu.Lock()
		requests = append(requests, payload)
		mu.Unlock()

		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(server.Close)

	ctrl := gomock.NewController(t)
	logger := zerolog.Nop()
	config := configuration.NewWithOpts()
	config.Set(configuration.API_URL, server.URL)
	config.Set(configuration.ORGANIZATION, "11111111-1111-1111-1111-111111111111")
	config.Set(configuration.AUTHENTICATION_TOKEN, "test-token")

	networkAccess := mocks.NewMockNetworkAccess(ctrl)
	networkAccess.EXPECT().GetHttpClient().Return(server.Client()).AnyTimes()

	invocation := mocks.NewMockInvocationContext(ctrl)
	invocation.EXPECT().GetConfiguration().Return(config).AnyTimes()
	invocation.EXPECT().GetEnhancedLogger().Return(&logger).AnyTimes()
	invocation.EXPECT().GetNetworkAccess().Return(networkAccess).AnyTimes()

	capture := contributorcapture.NewCapture()
	capture.Add(contributorcapture.Record{
		Capability: contributorcapture.CapabilityOSS,
		ProjectID:  "22222222-2222-2222-2222-222222222222",
	})
	capture.Add(contributorcapture.Record{
		Capability: contributorcapture.CapabilityIaC,
		ProjectID:  "33333333-3333-3333-3333-333333333333",
	})
	capture.Add(contributorcapture.Record{
		Capability: contributorcapture.CapabilityOSS,
		ProjectID:  "22222222-2222-2222-2222-222222222222",
	})

	emitLegacyContributorBilling(context.Background(), invocation, capture, "/tmp/repo")

	require.True(t, contributorbilling.WaitWithTimeout(2*time.Second))

	mu.Lock()
	defer mu.Unlock()
	require.Len(t, requests, 2)
}

func Test_emitLegacyContributorBilling_SkipsWhenCaptureEmpty(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	invocation := mocks.NewMockInvocationContext(ctrl)

	emitLegacyContributorBilling(context.Background(), invocation, contributorcapture.NewCapture(), ".")

	assert.True(t, contributorbilling.WaitWithTimeout(time.Millisecond))
}

func Test_defaultRepoPath(t *testing.T) {
	t.Parallel()

	assert.Equal(t, ".", defaultRepoPath(""))
	assert.Equal(t, "/tmp/repo", defaultRepoPath("/tmp/repo"))
}

func Test_contributorBillingAuthHeader(t *testing.T) {
	t.Parallel()

	config := configuration.NewWithOpts()
	config.Set(configuration.AUTHENTICATION_TOKEN, "abc")
	assert.Equal(t, "token abc", contributorBillingAuthHeader(config))

	config = configuration.NewWithOpts()
	config.Set(configuration.AUTHENTICATION_BEARER_TOKEN, "oauth-token")
	assert.Equal(t, "Bearer oauth-token", contributorBillingAuthHeader(config))
}
