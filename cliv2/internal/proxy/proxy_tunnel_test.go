package proxy_test

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"sync/atomic"
	"testing"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/internal/proxy"
)

func newProxy(t *testing.T, insecureHTTPS bool) *proxy.WrapperProxy {
	t.Helper()
	config := setup(t, "testcache", "1.1.1")
	t.Cleanup(func() { teardown(t, "testcache") })
	config.Set(configuration.INSECURE_HTTPS, insecureHTTPS)

	wp, err := proxy.NewWrapperProxy(config, "1.1.1", &debugLogger, caData)
	require.NoError(t, err)
	t.Cleanup(wp.Transport().CloseIdleConnections)
	return wp
}

func startProxy(t *testing.T, insecureHTTPS bool) *proxy.WrapperProxy {
	t.Helper()
	wp := newProxy(t, insecureHTTPS)
	require.NoError(t, wp.Start())
	t.Cleanup(wp.Close)
	return wp
}

func newCountingClient(t *testing.T, wp *proxy.WrapperProxy) (*http.Client, *atomic.Int32) {
	t.Helper()
	client, err := helper_getHttpClient(wp, true)
	require.NoError(t, err)

	var dials atomic.Int32
	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		dials.Add(1)
		return (&net.Dialer{}).DialContext(ctx, network, addr)
	}
	t.Cleanup(transport.CloseIdleConnections)
	return client, &dials
}

type fetched struct {
	statusCode     int
	contentLength  int64
	chunked        bool
	closeAnnounced bool
	body           []byte
}

func fetch(t *testing.T, client *http.Client, url string, connectionClose bool) fetched {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	req.Close = connectionClose

	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return fetched{
		statusCode:     resp.StatusCode,
		contentLength:  resp.ContentLength,
		chunked:        slices.Contains(resp.TransferEncoding, "chunked"),
		closeAnnounced: resp.Close,
		body:           body,
	}
}

func newOrigin(t *testing.T) (*httptest.Server, []byte) {
	t.Helper()
	payload := bytes.Repeat([]byte("snyk"), 16*1024)

	mux := http.NewServeMux()
	mux.HandleFunc("/fixed", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
		_, _ = w.Write(payload)
	})
	mux.HandleFunc("/chunked", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(payload[:len(payload)/2])
		w.(http.Flusher).Flush()
		_, _ = w.Write(payload[len(payload)/2:])
	})
	mux.HandleFunc("/empty", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	origin := httptest.NewTLSServer(mux)
	t.Cleanup(origin.Close)
	return origin, payload
}

func Test_proxy_tunnelReuse(t *testing.T) {
	tests := []struct {
		name            string
		connectionClose bool
		expectedTunnels int32
	}{
		{name: "keep-alive client reuses a single tunnel and the proxy keeps it open", connectionClose: false, expectedTunnels: 1},
		{name: "client sending Connection: close gets one tunnel per request and the proxy announces the close", connectionClose: true, expectedTunnels: 3},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			origin, _ := newOrigin(t)
			client, dials := newCountingClient(t, startProxy(t, true))

			for range 3 {
				result := fetch(t, client, origin.URL+"/empty", tc.connectionClose)
				assert.Equal(t, http.StatusNoContent, result.statusCode)
				assert.Equal(t, tc.connectionClose, result.closeAnnounced)
			}

			assert.Equal(t, tc.expectedTunnels, dials.Load())
		})
	}
}

func Test_proxy_responseFraming(t *testing.T) {
	origin, payload := newOrigin(t)
	client, _ := newCountingClient(t, startProxy(t, true))

	tests := []struct {
		name          string
		path          string
		status        int
		contentLength int64
		chunked       bool
		body          []byte
	}{
		{name: "content-length is preserved", path: "/fixed", status: http.StatusOK, contentLength: int64(len(payload)), chunked: false, body: payload},
		{name: "chunked is passed through", path: "/chunked", status: http.StatusOK, contentLength: -1, chunked: true, body: payload},
		{name: "no content", path: "/empty", status: http.StatusNoContent, contentLength: 0, chunked: false, body: []byte{}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := fetch(t, client, origin.URL+tc.path, false)

			assert.Equal(t, tc.status, result.statusCode)
			assert.Equal(t, tc.contentLength, result.contentLength)
			assert.Equal(t, tc.chunked, result.chunked)
			assert.Equal(t, tc.body, result.body)
		})
	}
}
