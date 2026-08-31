package ui

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	xansi "github.com/charmbracelet/x/ansi"
	xterm "github.com/charmbracelet/x/term"
	"golang.org/x/sys/unix"
)

// glyphWidths adalah tabel override lebar glyph hasil kalibrasi terminal aktif.
var glyphWidths = map[rune]int{}

// Probe representatif tiap kelas glyph. Terminal/font merender lebar secara
// seragam per range, jadi cukup satu pengukuran per kelas lalu diperluas.
const (
	probeBMPPUA = '\uE725'     // Nerd Font BMP (U+E000-F8FF)
	probeSMPPUA = '\U000F021A' // Nerd Font MDI/SMP (U+F0000+)
)

// SetGlyphWidths memasang tabel lebar terkalibrasi (panggil sebelum TUI start).
func SetGlyphWidths(m map[rune]int) {
	glyphWidths = m
}

// runeDisplayWidth mengembalikan lebar visual rune: prioritas hasil kalibrasi,
// fallback ke tabel Unicode standar (xansi).
func runeDisplayWidth(r rune) int {
	if w, ok := glyphWidths[r]; ok {
		return w
	}
	return xansi.StringWidth(string(r))
}

func isBMPPUA(r rune) bool { return r >= 0xE000 && r <= 0xF8FF }
func isSMPPUA(r rune) bool {
	return (r >= 0xF0000 && r <= 0xFFFFD) || (r >= 0x100000 && r <= 0x10FFFD)
}

// MeasureGlyphWidths mengukur lebar render AKTIF glyph langsung ke terminal via
// cursor position report (DSR 6n — mekanisme yang sama dipakai vim): cetak
// glyph, tanya posisi kursor, selisih kolom = lebar visual sebenarnya.
// Glyph PUA dikalibrasi per-kelas range (satu probe mewakili satu range),
// glyph spesial lain (box-drawing, dsb) diukur individual.
func MeasureGlyphWidths(glyphs []rune) map[rune]int {
	m, _ := MeasureGlyphWidthsWithLog(glyphs)
	return m
}

// MeasureGlyphWidthsWithLog sama seperti MeasureGlyphWidths namun mengembalikan
// log proses untuk diagnosa (dipakai oleh perintah `zf cal`).
func MeasureGlyphWidthsWithLog(glyphs []rune) (map[rune]int, []string) {
	measured := map[rune]int{}
	log := []string{}

	if len(glyphs) == 0 || !xterm.IsTerminal(os.Stdin.Fd()) || !xterm.IsTerminal(os.Stderr.Fd()) {
		return measured, append(log, "SKIP: stdin/stderr bukan TTY interaktif")
	}

	oldState, err := xterm.MakeRaw(os.Stdin.Fd())
	if err != nil {
		return measured, append(log, fmt.Sprintf("SKIP: MakeRaw gagal: %v", err))
	}
	defer xterm.Restore(os.Stdin.Fd(), oldState)

	out := os.Stderr

	// Kelompokkan rune unik menjadi kelas kalibrasi: satu probe per range PUA,
	// individual untuk rune lain. Meminimalkan roundtrip (ramah SSH mobile).
	type probeKey struct{ class, runeKey rune }
	const (
		classExact = iota
		classBMP
		classSMP
	)
	reps := map[probeKey]rune{}
	for _, r := range glyphs {
		switch {
		case isBMPPUA(r):
			reps[probeKey{classBMP, probeBMPPUA}] = probeBMPPUA
		case isSMPPUA(r):
			reps[probeKey{classSMP, probeSMPPUA}] = probeSMPPUA
		default:
			reps[probeKey{classExact, r}] = r
		}
	}

	fmt.Fprint(out, "\r")
	consecutiveFails := 0
	for k, rep := range reps {
		fmt.Fprintf(out, "%s\x1b[6n\r", string(rep))
		col, err := readCursorColumn(os.Stdin.Fd(), 25*time.Millisecond)
		if err != nil {
			consecutiveFails++
			log = append(log, fmt.Sprintf("PROBE U+%05X FAIL: %v", rep, err))
			// Terminal tidak menjawab CPR sama sekali -> fail-fast hentikan segera
			if consecutiveFails >= 1 && len(measured) == 0 {
				log = append(log, "ABORT: terminal tidak merespons DSR 6n")
				break
			}
			continue
		}
		consecutiveFails = 0
		w := col - 1
		log = append(log, fmt.Sprintf("PROBE U+%05X -> %d sel", rep, w))
		// Sanity clamp: glyph TUI valid hanya 1-4 sel
		if w >= 1 && w <= 4 {
			for _, r := range glyphs {
				sameClass := (k.class == classBMP && isBMPPUA(r)) ||
					(k.class == classSMP && isSMPPUA(r)) ||
					(k.class == classExact && r == rep)
				if sameClass {
					measured[r] = w
				}
			}
		}
	}

	cleanupCalibration(out)
	return measured, log
}

// readCursorColumn membaca respons CPR "\x1b[<row>;<col>R" dari fd stdin
// memakai non-blocking poll via syscall — tidak bergantung pada dukungan
// SetReadDeadline os.File yang tidak konsisten antar platform.
func readCursorColumn(fd uintptr, timeout time.Duration) (int, error) {
	if err := unix.SetNonblock(int(fd), true); err != nil {
		return 0, fmt.Errorf("setnonblock: %w", err)
	}
	defer func() { _ = unix.SetNonblock(int(fd), false) }()

	deadline := time.Now().Add(timeout)
	buf := make([]byte, 1)
	var acc []byte
	for {
		n, err := unix.Read(int(fd), buf)
		if n > 0 {
			acc = append(acc, buf[0])
			if buf[0] == 'R' {
				return parseCPR(string(acc))
			}
			if len(acc) > 32 {
				return 0, errors.New("respons CPR overflow")
			}
			continue
		}
		if err != nil && !errors.Is(err, unix.EAGAIN) && !errors.Is(err, unix.EWOULDBLOCK) {
			return 0, err
		}
		if time.Now().After(deadline) {
			return 0, errors.New("timeout menunggu respons DSR 6n")
		}
		time.Sleep(1 * time.Millisecond)
	}
}

// parseCPR mengambil nomor kolom dari urutan escape "\x1b[<row>;<col>R".
func parseCPR(s string) (int, error) {
	seq := strings.TrimSuffix(strings.TrimPrefix(s, "\x1b["), "R")
	parts := strings.Split(seq, ";")
	col, err := strconv.Atoi(parts[len(parts)-1])
	if err != nil || col <= 0 {
		return 0, fmt.Errorf("respons CPR tak valid: %q", s)
	}
	return col, nil
}

// cleanupCalibration menghapus jejak baris kalibrasi + mengosongkan input sisa
// agar byte respons yang telat tidak mencemari input buffer Bubble Tea.
func cleanupCalibration(out *os.File) {
	_, _ = out.WriteString("\r\x1b[2K")
	_ = unix.SetNonblock(0, true)
	defer func() { _ = unix.SetNonblock(0, false) }()
	deadline := time.Now().Add(10 * time.Millisecond)
	buf := make([]byte, 64)
	for time.Now().Before(deadline) {
		n, err := unix.Read(0, buf)
		if n <= 0 || err != nil {
			break
		}
	}
}
