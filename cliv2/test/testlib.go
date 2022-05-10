package test

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"testing"
)

type ProcessOutput struct {
	ExitCode int
	Stdout   string
	Stderr   string
}

func getBinPath(t *testing.T) string {
	cliBinPath := os.Getenv("TEST_SNYK_EXECUTABLE_PATH")

	_, err := os.Stat(cliBinPath)
	if err != nil {
		fmt.Println("error checking binPath")
		t.Fatal(err)
	}

	return cliBinPath
}

func LaunchAsProccess(t *testing.T, args []string) *ProcessOutput {
	snykCLIPath := getBinPath(t)
	t.Log("snykCLIPath:", snykCLIPath)

	if _, err := os.Stat(snykCLIPath); err != nil {
		t.Fatal("snyk CLI binary not found")
	}

	cmd := exec.Command(snykCLIPath, args...)
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf
	cmdOutput, err := cmd.Output()

	exitCode := 0
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else {
			// got an error but it's not an ExitError
			t.Fatal(err)
		}
	}

	output := ProcessOutput{
		ExitCode: exitCode,
		Stdout:   string(cmdOutput),
		Stderr:   stderrBuf.String(),
	}

	return &output
}

type TestProject struct {
	TestDirectoryPath string
	SnykCliPath       string
	CacheDirPath      string
}

func SetupTestProject(t *testing.T) *TestProject {
	snykCLIPath := getBinPath(t)
	t.Log("snykCLIPath:", snykCLIPath)

	snykCLIFilename := path.Base(snykCLIPath)
	tempDirForTest := t.TempDir()

	targetSnykCLIPath := path.Join(tempDirForTest, snykCLIFilename)
	t.Log("targetSnykCLIPath:", targetSnykCLIPath)
	err := copyFile(snykCLIPath, targetSnykCLIPath)
	if err != nil {
		t.Fatal(err)
	}

	err = os.Chmod(targetSnykCLIPath, 0755)
	if err != nil {
		t.Fatal(err)
	}

	cacheDirPath := path.Join(tempDirForTest, "cache")
	err = os.MkdirAll(cacheDirPath, 0755)
	if err != nil {
		t.Fatal(err)
	}

	testProject := TestProject{
		TestDirectoryPath: tempDirForTest,
		SnykCliPath:       targetSnykCLIPath,
		CacheDirPath:      cacheDirPath,
	}

	return &testProject
}

func (tp *TestProject) CopyFixture(t *testing.T, fixturePath string) error {
	err := copyDir(fixturePath, tp.TestDirectoryPath)
	return err
}

func SetupTestProjectWithFixture(t *testing.T, fixturePath string) *TestProject {
	testProject := SetupTestProject(t)
	err := testProject.CopyFixture(t, fixturePath)
	if err != nil {
		t.Fatal(err)
	}
	return testProject
}

func (tp *TestProject) LaunchCLI(t *testing.T, args []string) *ProcessOutput {
	t.Log("TestDirectoryPath:", tp.TestDirectoryPath)
	t.Log("SnykCliPath:", tp.SnykCliPath)

	cmd := exec.Command(tp.SnykCliPath, args...)
	cmd.Dir = tp.TestDirectoryPath
	cmd.Env = append(
		os.Environ(),
		fmt.Sprintf("SNYK_CACHE_PATH=%s", tp.CacheDirPath),
	)

	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf
	cmdOutput, err := cmd.Output()

	exitCode := 0
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else {
			// got an error but it's not an ExitError
			t.Fatal(err)
		}
	}

	output := ProcessOutput{
		ExitCode: exitCode,
		Stdout:   string(cmdOutput),
		Stderr:   stderrBuf.String(),
	}

	return &output
}

func copyFile(sourcePath, destinationPath string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(destinationPath)
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

func copyDir(sourceDir, destinationDir string) error {
	sourceStat, err := os.Stat(sourceDir)
	if err != nil {
		return err
	}

	if !sourceStat.IsDir() {
		return fmt.Errorf("%s is not a directory", sourceDir)
	}

	destStat, err := os.Stat(destinationDir)
	if err != nil {
		// destination path does not exist, create it
		err = os.MkdirAll(destinationDir, sourceStat.Mode())
		if err != nil {
			return err
		}
	}

	if !destStat.IsDir() {
		return fmt.Errorf("%s is not a directory", destinationDir)
	}

	files, err := ioutil.ReadDir(sourceDir)
	if err != nil {
		return err
	}

	for _, fileInfo := range files {
		sourceFilePath := path.Join(sourceDir, fileInfo.Name())
		destFilePath := path.Join(destinationDir, fileInfo.Name())

		if fileInfo.IsDir() {
			err = copyDir(sourceFilePath, destFilePath)
		} else {
			err = copyFile(sourceFilePath, destFilePath)
		}

		if err != nil {
			return err
		}
	}

	return nil
}
