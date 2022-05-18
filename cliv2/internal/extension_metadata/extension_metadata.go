package extension_metadata

type ExtensionMetadata struct {
	Name            string   `json:"name"`
	Command         string   `json:"command"`
	Version         string   `json:"version"`
	HelpDescription string   `json:"help_description"`
	Options         []Option `json:"options"`
}

type Option struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Shorthand string `json:"shorthand"`
	Usage     string `json:"usage"`
}
