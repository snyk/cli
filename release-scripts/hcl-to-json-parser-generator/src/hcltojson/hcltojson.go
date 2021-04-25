package main

import (
	"encoding/json"

	"github.com/tmccombs/hcl2json/convert"
	"github.com/gopherjs/gopherjs/js"
)

func main() {
	js.Module.Get("exports").Set("hcltojson", hcltojson);
}

func hcltojson(input string) interface{} {
	jsonBytes, err := convert.Bytes([]byte(input), "", convert.Options{})
	if err != nil {
		panic(err.Error())
	}

	var result interface{}
	err = json.Unmarshal(jsonBytes, &result)
	if err != nil {
		panic(err.Error())
	}
	return result
}
