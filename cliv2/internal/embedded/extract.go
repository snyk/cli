package embedded

import (
	"os"
	"path/filepath"
)

func ExtractBytesToTarget(bytes []byte, targetFullPath string) error {
	// make sure the directory exists
	dir := filepath.Dir(targetFullPath)
	err := os.MkdirAll(dir, 0755)
	if err != nil {
		return err
	}

	err = os.WriteFile(targetFullPath, bytes, 0755)
	if err != nil {
		return err
	}

	return nil
}
