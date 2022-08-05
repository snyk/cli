package embedded

import (
	"embed"
	"fmt"
	"io/fs"
	"math"
	"strings"
)

const (
	rootDirectory string = "_data"
)

//go:embed _data
var data embed.FS

type File struct {
	name       string
	path       string
	cachedData []byte
}

func ListFiles() []File {
	var result []File

	fs.WalkDir(data, rootDirectory, func(path string, d fs.DirEntry, err error) error {
		if !d.IsDir() {
			f := File{
				name: d.Name(),
				path: path,
			}
			result = append(result, f)
		}

		return err
	})

	return result
}

func (f *File) data() []byte {
	if f.cachedData == nil {
		var err error
		f.cachedData, err = data.ReadFile(f.path)
		fmt.Println(err)
	}
	return f.cachedData
}

func (f *File) Read(p []byte) (n int, err error) {
	tmp := f.data()
	n = int(math.Min(float64(len(tmp)), float64(len(p))))
	copy(p, tmp)
	return n, err
}

func (f *File) Size() int {
	return len(f.data())
}

func (f *File) Name() string {
	return f.name
}

func (f *File) Path() string {
	return strings.Replace(f.path, rootDirectory, "", 1)
}
