package httpauth

import (
	"encoding/asn1"
	"encoding/base64"
	"fmt"
	"log"
	"net/url"
	"reflect"
	"strings"

	"github.com/jcmturner/gokrb5/v8/gssapi"
)

type SpnegoProvider interface {
	GetToken(url *url.URL, responseToken string) (string, bool, error)
	Close() error
	SetLogger(logger *log.Logger)
}

func IsNTLMToken(token string) bool {
	isNtlm := strings.Contains(token, "TlRMTVNTU")
	return isNtlm
}

func GetMechanismsFromToken(token string) ([]string, error) {
	var result []string
	var err error

	if strings.Contains(token, " ") {
		temp := strings.Split(token, " ")
		token = temp[1]
	}

	if IsNTLMToken(token) {
		result = append(result, "NTLM")
	} else {
		var decodedToken []byte
		decodedToken, err = base64.StdEncoding.DecodeString(token)
		if err == nil {
			var oid asn1.ObjectIdentifier
			_, err = asn1.UnmarshalWithParams(decodedToken, &oid, fmt.Sprintf("application,explicit,tag:%v", 0))

			if reflect.DeepEqual(oid, asn1.ObjectIdentifier(gssapi.OIDSPNEGO.OID())) {
				result = append(result, string(gssapi.OIDSPNEGO))
			}

		}

		if err != nil {
			fmt.Println(err)
		}
	}

	return result, err
}
