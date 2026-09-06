// Command is-elf-binary reports whether a file begins with the ELF magic number.
//
// Usage: is-elf-binary <path>
//
// Prints 1 if the first four bytes match the ELF header signature, else 0.
// Short or empty files print 0. Used by capture-linux-metadata.sh when
// SKIP_HASH_IF_NOT_ELF=1 (npm): a non-ELF snyk path is a script/wrapper, so
// shasum verification and metadata are skipped for that source.
package main

import (
	"errors"
	"fmt"
	"io"
	"os"
)

// elfMagic is the four-byte ELF file identifier at offset 0 (0x7F 'E' 'L' 'F').
// Matching only indicates a native Linux/BSD object format or that the file is
// the Snyk CLI binary. It is just checking the 4 first bytes, so we cannot tell
// arm/x86.
const elfMagic = "\x7fELF"

func main() {
	if len(os.Args) != 2 {
		_, _ = fmt.Fprintln(os.Stderr, "Usage: is-elf-binary <file>")
		os.Exit(1)
	}

	f, err := os.Open(os.Args[1])
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Failed to read file: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	header := make([]byte, 4)
	_, err = io.ReadFull(f, header)
	if err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			fmt.Println("0")
			return
		}
		_, _ = fmt.Fprintf(os.Stderr, "Failed to read file: %v\n", err)
		os.Exit(1)
	}

	if string(header) == elfMagic {
		fmt.Println("1")
		return
	}

	fmt.Println("0")
}
