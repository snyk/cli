package helper

import (
	"fmt"
	"net"
	"net/http"
)

type MockServer struct {
	Port          int
	ResponseList  []*http.Response
	responseIndex int
	listener      net.Listener
}

func NewMockServer() *MockServer {
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		panic(err)
	}

	server := MockServer{ResponseList: []*http.Response{}}
	server.Port = listener.Addr().(*net.TCPAddr).Port
	server.listener = listener
	fmt.Println("Using port:", listener.Addr().(*net.TCPAddr).Port)

	return &server
}

func (m *MockServer) Listen() {
	http.Serve(m.listener, m)
}

func (m *MockServer) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	var response *http.Response

	if m.responseIndex < len(m.ResponseList) {
		response = m.ResponseList[m.responseIndex]
		m.responseIndex++
	} else {
		response = &http.Response{StatusCode: 200}
	}

	fmt.Printf("%4d. Request:  %v\n", m.responseIndex, request)
	fmt.Printf("%4d. Response: %v\n", m.responseIndex, response)

	for k, v := range response.Header {
		for i := range v {
			writer.Header().Add(k, v[i])
		}
	}

	writer.WriteHeader(response.StatusCode)
}
