package migrations

import (
	"embed"
	"strings"
)

//go:embed *.sql
var files embed.FS

func All() map[string][]string {
	entries, err := files.ReadDir(".")
	if err != nil {
		panic(err)
	}

	out := make(map[string][]string, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		data, err := files.ReadFile(name)
		if err != nil {
			panic(err)
		}
		statements := strings.Split(
			strings.ReplaceAll(
				string(data),
				"CREATE TABLE",
				"CREATE TABLE IF NOT EXISTS",
			),
			"--> statement-breakpoint",
		)
		for i, s := range statements {
			statements[i] = strings.TrimSpace(s)
		}
		out[name] = statements
	}
	return out
}
