package utils

import (
	"os"
	"strings"
)

// isFlagToken checks if a token is a flag token.
func isFlagToken(token string) bool {
	return strings.HasPrefix(token, "-") || token == "--"
}

// consumeValue consumes values from a list of tokens until a flag token is encountered.
func consumeValue(tokens []string, start int) (string, int) {
	j := start
	values := []string{}
	for j < len(tokens) && !isFlagToken(tokens[j]) {
		values = append(values, tokens[j])
		j++
	}
	if len(values) == 0 {
		return "", start
	}
	return strings.Join(values, " "), j
}

type CaptureAllArgsResult struct {
	Command        string
	Args           []string
	PrimaryFlags   map[string]interface{}
	SecondaryFlags map[string]interface{}
}

func CaptureAllEnvVars() map[string]string {
	envVars := make(map[string]string)
	for _, envVar := range os.Environ() {
		parts := strings.SplitN(envVar, "=", 2)
		envVars[parts[0]] = parts[1]
	}
	return envVars
}

// CaptureAllArgs parses CLI arguments into command string, positional args,
// primary flags (before --), and secondary flags (after --).
func CaptureAllArgs(args []string) CaptureAllArgsResult {
	result := CaptureAllArgsResult{
		Command:        strings.Join(args, " "),
		Args:           []string{},
		PrimaryFlags:   make(map[string]interface{}),
		SecondaryFlags: make(map[string]interface{}),
	}

	primaryFlags := result.PrimaryFlags
	secondaryFlags := result.SecondaryFlags

	// Collect leading positional args (subcommands) until first flag or "--"
	positional := []string{}
	i := 0
	for i < len(args) {
		arg := args[i]
		if isFlagToken(arg) {
			break
		}
		positional = append(positional, arg)
		i++
	}
	result.Args = positional

	// Parse flags before "--"
	for i < len(args) {
		arg := args[i]
		if arg == "--" {
			i++
			break
		}

		if strings.HasPrefix(arg, "--") {
			name := strings.TrimPrefix(arg, "--")
			if eq := strings.Index(name, "="); eq >= 0 {
				primaryFlags[name[:eq]] = name[eq+1:]
				i++
				continue
			}
			val, next := consumeValue(args, i+1)
			if next > i+1 {
				primaryFlags[name] = val
				i = next
				continue
			}
			primaryFlags[name] = nil
			i++
			continue
		}

		if strings.HasPrefix(arg, "-") {
			name := strings.TrimPrefix(arg, "-")
			if eq := strings.Index(name, "="); eq >= 0 {
				primaryFlags[name[:eq]] = name[eq+1:]
				i++
				continue
			}
			// Short-flag bundle like -abc => a,b,c as booleans when no explicit value provided
			if len(name) > 1 {
				for _, ch := range name {
					primaryFlags[string(ch)] = nil
				}
				i++
				continue
			}
			// Single short flag, may have multi-word value
			val, next := consumeValue(args, i+1)
			if next > i+1 {
				primaryFlags[name] = val
				i = next
				continue
			}
			primaryFlags[name] = nil
			i++
			continue
		}

		// Fallback: treat as positional if something unexpected appears
		positional = append(positional, arg)
		i++
	}

	// Parse secondary flags/args after "--": treat as name-value pairs (1:1 mapping)
	for i < len(args) {
		token := args[i]
		if strings.HasPrefix(token, "--") || strings.HasPrefix(token, "-") {
			name := token
			if strings.HasPrefix(token, "--") {
				name = strings.TrimPrefix(token, "--")
			} else {
				name = strings.TrimPrefix(token, "-")
			}
			if eq := strings.Index(name, "="); eq >= 0 {
				secondaryFlags[name[:eq]] = name[eq+1:]
				i++
				continue
			}
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				secondaryFlags[name] = args[i+1]
				i += 2
				continue
			}
			secondaryFlags[name] = nil
			i++
			continue
		}
		// skip non-flag tokens in secondary section
		i++
	}

	return result
}
