package embedded

import (
	"embed"
	"io/fs"
	"math"
	"os"
	"path/filepath"
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

func (f *File) data() ([]byte, error) {
	var err error
	if f.cachedData == nil {
		f.cachedData, err = data.ReadFile(f.path)
	}
	return f.cachedData, err
}

func (f *File) Read(p []byte) (n int, err error) {
	tmp, err := f.data()
	n = int(math.Min(float64(len(tmp)), float64(len(p))))
	copy(p, tmp)
	return n, err
}

func (f *File) Size() int {
	d, _ := f.data()
	return len(d)
}

func (f *File) Name() string {
	return f.name
}

func (f *File) Path() string {
	return strings.Replace(f.path, rootDirectory, "", 1)
}

func (f *File) SaveToLocalFilesystem(destPath string, fileMode fs.FileMode) (err error) {
	size := f.Size()
	data := make([]byte, size)

	_, err = f.Read(data)
	if err == nil {
		folder := filepath.Dir(destPath)
		_, err = os.Stat(folder)
		if os.IsNotExist(err) {
			err = os.MkdirAll(folder, fileMode)
		}
	}

	if err == nil {
		err = os.WriteFile(destPath, data, fileMode)
	}
	return err
}
