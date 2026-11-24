package main

import (
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertWords(t *testing.T, words map[string]bool, present []string, absent []string) {
	t.Helper()
	for _, w := range present {
		if !words[w] {
			t.Errorf("expected %q to be extracted, got %v", w, words)
		}
	}
	for _, w := range absent {
		if words[w] {
			t.Errorf("expected %q not to be extracted", w)
		}
	}
}

func Test_extractWordsFromFile_onlyHarvestsLogAndErrorCallArguments(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sample.go")
	writeFile(t, path, "package sample\n\n"+
		"import (\n\t\"fmt\"\n\t\"regexp\"\n\t_ \"example.com/importpathword\"\n)\n\n"+
		"type config struct {\n\tField string `json:\"structtagword\"`\n}\n\n"+
		"var pattern = regexp.MustCompile(`regexonlyword`)\n\n"+
		"const constantword = \"constantword\"\n\n"+
		"func run() error {\n\treturn fmt.Errorf(\"logmessageword failed\")\n}\n")

	words, err := extractWordsFromFile(path)
	if err != nil {
		t.Fatal(err)
	}

	assertWords(t, words,
		[]string{"logmessageword", "failed"},
		[]string{"importpathword", "structtagword", "regexonlyword", "constantword"})
}

func Test_extractWordsFromString_unquotesEscapeSequences(t *testing.T) {
	words := map[string]bool{}

	extractWordsFromString(`"please\nenter\tvalue\"quoted\""`, words)

	assertWords(t, words,
		[]string{"please", "enter", "value", "quoted"},
		[]string{"nenter", "tvalue", "pleasenenter"})
}

func Test_extractWordsFromString_handlesRawStrings(t *testing.T) {
	words := map[string]bool{}

	extractWordsFromString("`literal\\nbackslash`", words)

	assertWords(t, words, []string{"literal", "nbackslash"}, nil)
}

func Test_extractWordsFromRepo_skipsGeneratedOutputAndGenerator(t *testing.T) {
	repo := t.TempDir()
	logCall := func(word string) string {
		return "package p\n\nimport \"fmt\"\n\nfunc f() { fmt.Println(\"" + word + "\") }\n"
	}
	writeFile(t, filepath.Join(repo, "internal", "utils", "allowed_words_generated.go"), logCall("generatedword"))
	writeFile(t, filepath.Join(repo, "internal", "tools", "gen-allowed-words", "main.go"), logCall("generatorword"))
	writeFile(t, filepath.Join(repo, "pkg", "core", "main.go"), logCall("productionword"))

	words, err := extractWordsFromRepo(repo)
	if err != nil {
		t.Fatal(err)
	}

	assertWords(t, words, []string{"productionword"}, []string{"generatedword", "generatorword"})
}

func Test_resolveGAFModule_findsGAFSourceInModuleCache(t *testing.T) {
	cliRepoPath, err := filepath.Abs("../../..")
	if err != nil {
		t.Fatal(err)
	}

	version, dir, err := resolveGAFModule(cliRepoPath)
	if err != nil {
		t.Fatal(err)
	}

	if version == "" {
		t.Error("expected a GAF version")
	}
	if _, err := os.Stat(filepath.Join(dir, "pkg", "logging")); err != nil {
		t.Errorf("expected GAF source at %q: %v", dir, err)
	}
}
