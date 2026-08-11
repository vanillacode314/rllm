// Package hlc implements the Hybrid Logical Clock used by the sync server,
package hlc

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/matoous/go-nanoid"
)

const Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"
const clientIDLength = 21

// HLC is a Hybrid Logical Clock: a physical time, a logical counter, and a unique client ID.
type HLC struct {
	PhysicalTime int64
	LogicalTime  int
	ClientID     string
}

// Generate creates a new HLC with zero times with a generated client ID.
func Generate() (*HLC, error) {
	clientId, err := gonanoid.Generate(Alphabet, clientIDLength)
	if err != nil {
		return nil, err
	}
	return &HLC{PhysicalTime: 0, LogicalTime: 0, ClientID: clientId}, nil
}

// Generate creates a new HLC with zero times with the given client ID.
func GenerateWithClientId(clientId string) (*HLC, error) {
	if clientId == "" {
		return nil, errors.New("client ID cannot be empty")
	}
	return &HLC{PhysicalTime: 0, LogicalTime: 0, ClientID: clientId}, nil
}

// String serializes the clock as "physicalTime-logicalTime-clientId", where
// physical time is zero-padded decimal (15 digits) and logical time is
// zero-padded base36 (5 digits).
func (h *HLC) String() string {
	return fmt.Sprintf("%015d-%05s-%s", h.PhysicalTime, strconv.FormatInt(int64(h.LogicalTime), 36), h.ClientID)
}

// FromString parses a serialized clock, splitting on the first two dashes.
func FromString(value string) (*HLC, error) {
	dashIndices := []int{}
	for i := 0; i < len(value); i++ {
		if value[i] == '-' {
			dashIndices = append(dashIndices, i)
			if len(dashIndices) > 2 {
				break
			}
		}
	}
	if len(dashIndices) < 2 {
		return nil, fmt.Errorf("invalid HLC value: %s", value)
	}
	physicalStr := value[:dashIndices[0]]
	logicalStr := value[dashIndices[0]+1 : dashIndices[1]]
	clientID := value[dashIndices[1]+1:]

	if physicalStr == "" || logicalStr == "" || clientID == "" {
		return nil, fmt.Errorf("invalid HLC value: %s", value)
	}
	physical, err := strconv.ParseInt(physicalStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid HLC value: %s", value)
	}
	logical, err := strconv.ParseInt(logicalStr, 36, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid HLC value: %s", value)
	}
	return &HLC{PhysicalTime: physical, LogicalTime: int(logical), ClientID: clientID}, nil
}
