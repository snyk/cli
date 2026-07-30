package interceptor

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/networking/contributorcapture"

	"github.com/elazarl/goproxy"
	"github.com/stretchr/testify/assert"
)

type mockRoundTripper struct {
	err error
}

func (m mockRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, m.err
}

func TestNetworkInjector_ErrorHandling(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	logger := zerolog.Nop()

	expectedErr := errors.New("network error")

	networkAccessMock := mocks.NewMockNetworkAccess(ctrl)
	roundTripperMock := mockRoundTripper{err: expectedErr}
	networkAccessMock.EXPECT().GetRoundTripper().Return(roundTripperMock)

	invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
	invocationCtxMock.EXPECT().GetNetworkAccess().Return(networkAccessMock).AnyTimes()
	invocationCtxMock.EXPECT().GetEnhancedLogger().Return(&logger).AnyTimes()

	ni := NewNetworkInjector(invocationCtxMock, context.Background())
	handler := ni.GetHandler()

	req := &http.Request{}
	proxyCtx := &goproxy.ProxyCtx{}

	_, resp := handler(req, proxyCtx)
	defer func() {
		if resp != nil && resp.Body != nil {
			_ = resp.Body.Close()
		}
	}()

	// We rely on goproxy's error context when RoundTrips fail in the interceptor.
	assert.Equal(t, expectedErr, proxyCtx.Error, "proxyCtx.Error should be populated with the RoundTrip error")

	// Goproxy will send the request again if the response is nil, why it's imperative this does not happen.
	assert.Nil(t, resp, "response should not be nil when RoundTrip returns an error")
}

func TestNetworkInjector_AttachesRequestContext(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	logger := zerolog.Nop()
	capture := contributorcapture.NewCapture()
	requestContext := contributorcapture.WithCapture(context.Background(), capture)

	var capturedContext context.Context
	roundTripperMock := mockRoundTripperWithContext{onRoundTrip: func(req *http.Request) {
		capturedContext = req.Context()
	}}

	networkAccessMock := mocks.NewMockNetworkAccess(ctrl)
	networkAccessMock.EXPECT().GetRoundTripper().Return(roundTripperMock)

	invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
	invocationCtxMock.EXPECT().GetNetworkAccess().Return(networkAccessMock).AnyTimes()
	invocationCtxMock.EXPECT().GetEnhancedLogger().Return(&logger).AnyTimes()

	ni := NewNetworkInjector(invocationCtxMock, requestContext)
	handler := ni.GetHandler()

	req := &http.Request{}
	proxyCtx := &goproxy.ProxyCtx{}
	_, _ = handler(req, proxyCtx)

	assert.Equal(t, requestContext, capturedContext)
	assert.Equal(t, capture, contributorcapture.FromContext(capturedContext))
}

type mockRoundTripperWithContext struct {
	onRoundTrip func(*http.Request)
}

func (m mockRoundTripperWithContext) RoundTrip(req *http.Request) (*http.Response, error) {
	if m.onRoundTrip != nil {
		m.onRoundTrip(req)
	}
	return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody}, nil
}
