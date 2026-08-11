package merkletree

import "math"

// round rounds number to the given decimal precision. It mirrors the depth
// calculation used by the reference implementation, which rounds before
// taking the ceiling to avoid floating point artifacts such as
// log(8)/log(2) == 2.9999999999999996.
func round(number float64, precision int) float64 {
	multiplier := math.Pow(10, float64(precision))
	return math.Round(number*multiplier) / multiplier
}
