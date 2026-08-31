package tree

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/icons"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Node merepresentasikan satu entri file atau folder di tree view
type Node struct {
	Name     string
	Path     string
	IsDir    bool
	Depth    int
	Icon     string
	Children []Node
	Expanded bool
}

// BuildTree membangun file tree ringan dengan depth cap dan ignore filter
func BuildTree(root string, maxDepth int) []Node {
	if maxDepth <= 0 {
		maxDepth = 2
	}
	return walk(root, 0, maxDepth)
}

func walk(dir string, depth, maxDepth int) []Node {
	if depth >= maxDepth {
		return nil
	}

	// Cegah symlink recursion loop dengan memeriksa lstat
	if fi, err := os.Lstat(dir); err == nil && fi.Mode()&os.ModeSymlink != 0 {
		if depth > 0 {
			return nil
		}
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	// Filter & sort: direktori dulu, baru file
	var dirs []os.DirEntry
	var files []os.DirEntry

	for _, e := range entries {
		name := e.Name()
		if shouldIgnore(name) {
			continue
		}
		if e.IsDir() {
			dirs = append(dirs, e)
		} else {
			files = append(files, e)
		}
	}

	sort.Slice(dirs, func(i, j int) bool { return dirs[i].Name() < dirs[j].Name() })
	sort.Slice(files, func(i, j int) bool { return files[i].Name() < files[j].Name() })

	var nodes []Node
	count := 0
	maxEntries := 60 // Cap total per level agar TUI tetap instan & responsif

	for _, d := range dirs {
		if count >= maxEntries {
			break
		}
		p := filepath.Join(dir, d.Name())
		children := walk(p, depth+1, maxDepth)
		nodes = append(nodes, Node{
			Name:     d.Name(),
			Path:     p,
			IsDir:    true,
			Depth:    depth,
			Icon:     icons.ForFile(d.Name(), true),
			Children: children,
			Expanded: depth < 1, // Auto-expand level teratas
		})
		count++
	}

	for _, f := range files {
		if count >= maxEntries {
			break
		}
		p := filepath.Join(dir, f.Name())
		nodes = append(nodes, Node{
			Name:     f.Name(),
			Path:     p,
			IsDir:    false,
			Depth:    depth,
			Icon:     icons.ForFile(f.Name(), false),
			Children: nil,
			Expanded: false,
		})
		count++
	}

	return nodes
}

func shouldIgnore(name string) bool {
	switch name {
	case ".git", "node_modules", "vendor", "target", "dist", "build", ".next", ".cache", "__pycache__", ".turbo":
		return true
	}
	if strings.HasPrefix(name, ".") && name != ".env" && name != ".gitignore" {
		return true
	}
	return false
}

// FlattenNodes meratakan tree menjadi slice baris tampilan
func FlattenNodes(nodes []Node) []Node {
	var result []Node
	for _, n := range nodes {
		result = append(result, n)
		if n.IsDir && n.Expanded && len(n.Children) > 0 {
			result = append(result, FlattenNodes(n.Children)...)
		}
	}
	return result
}
