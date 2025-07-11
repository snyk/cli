package interceptor

import (
	"github.com/elazarl/goproxy"
)

// Interceptor is an interface that defines self-registering MITM-style handlers
// for interacting with requests send to the go proxy from the legacy CLI.
// Add a new interceptor by implementing the Interceptor interface and adding it to
// the GetRegisteredInterceptors function.
type Interceptor interface {
	GetHandler() goproxy.FuncReqHandler
	GetCondition() goproxy.ReqCondition
}
