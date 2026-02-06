package utils

import (
	"bufio"
	"os"
)

func WriteToFile(filePath string, data string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}

	defer func() {
		_ = file.Close()
	}()

	w := bufio.NewWriter(file)
	_, err = w.WriteString(data)
	if err != nil {
		return err
	}

	return w.Flush()
}
