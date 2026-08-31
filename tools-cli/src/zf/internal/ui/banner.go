package ui

import "fmt"

// BannerText returns the standard Goblin Vault ASCII Art banner for ZF
func BannerText() string {
	banner := `
  ███████╗███████╗
  ╚══███╔╝██╔════╝
    ███╔╝ █████╗  
   ███╔╝  ██╔══╝  
  ███████╗██║     
  ╚══════╝╚═╝     `
	return fmt.Sprintf("\033[1;37m%s\033[0m\n  \033[1;37mZF Navigation Engine\033[0m\n", banner)
}
