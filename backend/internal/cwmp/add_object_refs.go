package cwmp

import (
	"regexp"
	"strconv"
)

var addObjectReference = regexp.MustCompile(`\{prev([0-9]*)\}`)

// resolveAddObjectReferences expands {prev} to the latest AddObject result and
// {prevN} to the Nth result (1-based).
func resolveAddObjectReferences(value string, instances []string) string {
	return addObjectReference.ReplaceAllStringFunc(value, func(token string) string {
		match := addObjectReference.FindStringSubmatch(token)
		index := len(instances) - 1
		if match[1] != "" {
			n, err := strconv.Atoi(match[1])
			if err != nil || n < 1 {
				return token
			}
			index = n - 1
		}
		if index < 0 || index >= len(instances) {
			return token
		}
		return instances[index]
	})
}
