package rest

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync-server/db"
	"time"

	eventspb "proto/rllm/events"

	"google.golang.org/protobuf/proto"
)

type RESTHandler struct {
	Db *db.DbClient
}

const defaultPageSize = uint(50)

func (s RESTHandler) GetMessagesStream(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	accountId := r.URL.Query().Get("accountId")
	after := r.URL.Query().Get("after")
	pageSize := defaultPageSize
	if raw := r.URL.Query().Get("pageSize"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 16)
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid pageSize got '%s', expected a positive integer", raw), http.StatusBadRequest)
			return
		}
		pageSize = uint(parsed)
		if pageSize < 1 {
			http.Error(w, fmt.Sprintf("invalid pageSize got '%s', expected a positive integer", raw), http.StatusBadRequest)
			return
		}
	}
	hasMore := false
	cursor := after
	for {
		events, err := s.Db.GetMessagesByCursor(ctx, accountId, cursor, pageSize+1)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to get events: %v", err), http.StatusInternalServerError)
			return
		}
		hasMore = len(events) > int(pageSize)
		if hasMore {
			events = events[:pageSize]
			cursor = events[pageSize-1].Timestamp
		}

		payloadEvents := make([]*eventspb.SyncServerGetEventsResponsePayload, len(events))
		for i, event := range events {
			payloadEvents[i] = &eventspb.SyncServerGetEventsResponsePayload{
				Timestamp: event.Timestamp,
				Signature: event.Signature,
				Data:      event.Data,
			}
		}
		message, err := proto.Marshal(&eventspb.SyncServerGetEventsResponse{
			HasMore:   hasMore,
			NextAfter: &cursor,
			PageSize:  uint32(pageSize),
			Events:    payloadEvents,
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to marshal response: %v", err), http.StatusInternalServerError)
			return
		}
		header := make([]byte, 4)
		binary.LittleEndian.PutUint32(header, uint32(len(message)))
		_, err = w.Write(header)
		if err != nil {
			log.Printf("failed to write header: %v", err)
			return
		}
		_, err = w.Write(message)
		if err != nil {
			log.Printf("failed to write message: %v", err)
			return
		}
		if !hasMore {
			break
		}
	}
}

func (s RESTHandler) GetId(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	id, err := s.Db.GetId(ctx)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Write([]byte(id))
}

func (s RESTHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	tokens.mu.Lock()
	tokenHeader := r.Header.Get("authorization")
	if tokenHeader == "" || len(tokenHeader) < AUTH_HEADER_PREFIX_LENGTH+1 {
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}
	tokenHeader = tokenHeader[AUTH_HEADER_PREFIX_LENGTH:]
	token, ok := tokens.items[tokenHeader]
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}
	if token.expiresAt < uint(time.Now().Unix()) {
		delete(tokens.items, tokenHeader)
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}

	var body struct {
		AccountId string `json:"accountId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, fmt.Sprintf("failed to decode JSON body: %v", err), http.StatusBadRequest)
		tokens.mu.Unlock()
		return
	}
	if token.accountId != body.AccountId {
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}
	tokens.mu.Unlock()
	err := s.Db.DeleteAccount(ctx, body.AccountId)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
