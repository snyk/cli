package proxy_test

import (
	"encoding/base64"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newUpstreamProxy(t *testing.T, username, password string) (*url.URL, *atomic.Value) {
	t.Helper()
	var received atomic.Value
	expected := "Basic " + base64.StdEncoding.EncodeToString([]byte(username+":"+password))

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received.Store(r.Header.Get("Proxy-Authorization"))
		if r.Method != http.MethodConnect || r.Header.Get("Proxy-Authorization") != expected {
			w.Header().Set("Proxy-Authenticate", `Basic realm="upstream"`)
			w.WriteHeader(http.StatusProxyAuthRequired)
			return
		}

		target, err := net.Dial("tcp", r.Host)
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		client, _, err := http.NewResponseController(w).Hijack()
		if !assert.NoError(t, err) {
			_ = target.Close()
			return
		}
		_, _ = client.Write([]byte("HTTP/1.1 200 Connection established\r\n\r\n"))
		go func() { _, _ = io.Copy(target, client); _ = target.Close() }()
		go func() { _, _ = io.Copy(client, target); _ = client.Close() }()
	}))
	t.Cleanup(server.Close)

	upstreamUrl, err := url.Parse(server.URL)
	require.NoError(t, err)
	return upstreamUrl, &received
}

func requireGetFails(t *testing.T, client *http.Client, target string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, target, nil)
	require.NoError(t, err)
	resp, err := client.Do(req)
	if resp != nil {
		_ = resp.Body.Close()
	}
	require.ErrorIs(t, err, io.EOF)
}

func Test_proxy_upstreamBasicAuthChain(t *testing.T) {
	origin, _ := newOrigin(t)
	tests := []struct {
		name     string
		password string
		succeeds bool
	}{
		{name: "valid credentials are sent upstream and the request succeeds", password: "secret", succeeds: true},
		{name: "wrong credentials are rejected by the upstream proxy with 407 and the client connection is dropped", password: "wrong", succeeds: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			upstreamUrl, received := newUpstreamProxy(t, "user", "secret")
			upstreamUrl.User = url.UserPassword("user", tc.password)
			wp := newProxy(t, true)
			wp.SetUpstreamProxyFromUrl(upstreamUrl.String())
			require.NoError(t, wp.Start())
			t.Cleanup(wp.Close)
			client, _ := newCountingClient(t, wp)

			if tc.succeeds {
				result := fetch(t, client, origin.URL+"/empty", false)
				assert.Equal(t, http.StatusNoContent, result.statusCode)
			} else {
				requireGetFails(t, client, origin.URL+"/empty")
			}

			assert.Equal(t, "Basic "+base64.StdEncoding.EncodeToString([]byte("user:"+tc.password)), received.Load())
		})
	}
}

func Test_proxy_insecureHTTPS(t *testing.T) {
	origin, _ := newOrigin(t)
	tests := []struct {
		name     string
		insecure bool
	}{
		{name: "untrusted origin certificate is accepted", insecure: true},
		{name: "untrusted origin certificate is rejected and the client connection is dropped", insecure: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			wp := startProxy(t, tc.insecure)
			client, _ := newCountingClient(t, wp)

			assert.Equal(t, tc.insecure, wp.Transport().TLSClientConfig.InsecureSkipVerify)
			if tc.insecure {
				result := fetch(t, client, origin.URL+"/empty", false)
				assert.Equal(t, http.StatusNoContent, result.statusCode)
			} else {
				requireGetFails(t, client, origin.URL+"/empty")
			}
		})
	}
}
