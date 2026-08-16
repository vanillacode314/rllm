package handlers

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	"proto/peers"
	"sync-server/batch"
	client "sync-server/db"
	"sync-server/digest"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/proto"
)

// Hub tracks WebSocket connections per account topic and broadcasts event
// batches. Publish excludes the sender.
type Hub struct {
	mu   sync.Mutex
	subs map[string]map[*websocket.Conn]struct{}
}

// NewHub creates an empty Hub.
func NewHub() *Hub {
	return &Hub{subs: make(map[string]map[*websocket.Conn]struct{})}
}

// Subscribe registers conn for the account topic.
func (h *Hub) Subscribe(accountID string, c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	m := h.subs[accountID]
	if m == nil {
		m = make(map[*websocket.Conn]struct{})
		h.subs[accountID] = m
	}
	m[c] = struct{}{}
}

// Unsubscribe removes conn from the account topic.
func (h *Hub) Unsubscribe(accountID string, c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	m := h.subs[accountID]
	if m == nil {
		return
	}
	delete(m, c)
	if len(m) == 0 {
		delete(h.subs, accountID)
	}
}

// Publish sends data to every connection subscribed to the topic except the
// publishing connection.
func (h *Hub) Publish(accountID string, except *websocket.Conn, data []byte) {
	h.mu.Lock()
	m := h.subs[accountID]
	conns := make([]*websocket.Conn, 0, len(m))
	for c := range m {
		if c != except {
			conns = append(conns, c)
		}
	}
	h.mu.Unlock()
	for _, c := range conns {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err := c.Write(ctx, websocket.MessageBinary, data)
		cancel()
		if err != nil {
			log.Printf("[WS Publish] write failed: %v", err)
		}
	}
}

// ConnectionManager owns the per-connection state: the account and the
// server's clock client ID.
type ConnectionManager struct {
	accountID string
	clientID  string
	conn      *websocket.Conn
	db        *sql.DB
	hub       *Hub

	sendTimestampBatch *batch.Batcher[string]
	recomputeDebouncer *batch.Debouncer

	// pendingDigestUpdates counts digest queries we sent that have not yet
	// been answered. It is only mutated from the socket read loop; the mutex
	// keeps it safe if future callers come from other goroutines.
	digestMu             sync.Mutex
	pendingDigestUpdates int
}

// newConnectionManager wires the batchers and debouncer with the same
// parameters as the reference implementation.
func newConnectionManager(db *sql.DB, accountID string, clientID string, conn *websocket.Conn, hub *Hub) *ConnectionManager {
	m := &ConnectionManager{
		accountID: accountID,
		clientID:  clientID,
		conn:      conn,
		db:        db,
		hub:       hub,
	}
	m.sendTimestampBatch = batch.NewBatcher(30, 5*time.Second, func(timestamps []string) { m.flushSendTimestamp(timestamps) })
	m.recomputeDebouncer = batch.NewDebouncer(time.Second, func() {
		log.Printf("[WS Debouncer] Recomputing Merkle tree: accountId=%s", m.accountID)
		if err := client.RecomputeMerkleTree(m.db, m.accountID); err != nil {
			log.Printf("[WS Debouncer] Recompute failed: %v", err)
		}
	})
	return m
}

// close stops batchers and runs any pending recompute.
func (m *ConnectionManager) close() {
	m.sendTimestampBatch.Cancel()
	m.recomputeDebouncer.Flush()
}

// addPendingDigestUpdates records n digest queries sent to the peer.
func (m *ConnectionManager) addPendingDigestUpdates(n int) {
	m.digestMu.Lock()
	m.pendingDigestUpdates += n
	m.digestMu.Unlock()
}

// subPendingDigestUpdates records n digest updates received from the peer.
func (m *ConnectionManager) subPendingDigestUpdates(n int) {
	m.digestMu.Lock()
	m.pendingDigestUpdates -= n
	m.digestMu.Unlock()
}

// pendingDigestUpdatesDone reports whether every digest query we sent has been
// answered, i.e. the current reconciliation round has settled.
func (m *ConnectionManager) pendingDigestUpdatesDone() bool {
	m.digestMu.Lock()
	defer m.digestMu.Unlock()
	return m.pendingDigestUpdates == 0
}

// addSendTimestamp queues a stored event for timestamp, flushing immediately
// once the reconciliation round settles.
func (m *ConnectionManager) addSendTimestamp(timestamps []string) {
	if len(timestamps) == 0 {
		return
	}
	for _, timestamp := range timestamps {
		m.sendTimestampBatch.Add(timestamp)
	}
	if m.pendingDigestUpdatesDone() {
		m.sendTimestampBatch.Flush()
	}
}

func (m *ConnectionManager) recomputeMerkleTree() {
	m.recomputeDebouncer.MaybeExecute()
}

// write sends a binary frame, logging (not failing) on error.
func (m *ConnectionManager) write(data []byte) {
	if data == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := m.conn.Write(ctx, websocket.MessageBinary, data); err != nil {
		log.Printf("[WS Write] failed: %v", err)
	}
}

func (m *ConnectionManager) createHandshake(version string, rootDigest []byte, clientId string) []byte {
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_Handshake{
			Handshake: &peers.SyncHandshake{Version: version, RootDigest: rootDigest, ClientId: clientId},
		},
	})
}

func (m *ConnectionManager) createDigestQuery(merkleDepth uint32, paths [][]uint32) []byte {
	queries := make([]*peers.DigestQuery, 0, len(paths))
	for _, path := range paths {
		queries = append(queries, &peers.DigestQuery{Path: path})
	}
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_DigestQueries{
			DigestQueries: &peers.DigestQueries{MerkleDepth: merkleDepth, Queries: queries},
		},
	})
}

func (m *ConnectionManager) createEventBatch(events []*peers.EventBatchPayload) []byte {
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_EventBatch{
			EventBatch: &peers.EventBatch{Events: events},
		},
	})
}

func (m *ConnectionManager) createSendEventsWithTimestamp(timestamp string) []byte {
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_SendEventsAfterTimestamp{
			SendEventsAfterTimestamp: &peers.SendEventsAfterTimestamp{Timestamp: timestamp},
		}})
}

// flushSendTimestamp sends stored events for the requested timestamps.
func (m *ConnectionManager) flushSendTimestamp(timestamps []string) {
	timestamps = digest.Unique(timestamps)
	if len(timestamps) == 0 {
		return
	}
	events, err := client.GetMessagesByTimestamps(m.db, m.accountID, timestamps)
	if err != nil {
		log.Printf("[WS Batcher] Failed to query events: %v", err)
		return
	}
	if len(events) == 0 {
		log.Printf("[WS Batcher] Timestamps requested but events not found: accountId=%s timestamps=%v", m.accountID, timestamps)
		return
	}
	log.Printf("[WS Batcher] Sending batch: accountId=%s count=%d", m.accountID, len(events))
	peerEvents := make([]*peers.EventBatchPayload, 0, len(events))
	for _, event := range events {
		peerEvents = append(peerEvents, &peers.EventBatchPayload{
			Data:      event.Data,
			Signature: event.Signature,
			Timestamp: event.Timestamp,
		})
	}
	m.write(m.createEventBatch(peerEvents))
}

func (m *ConnectionManager) sendAfterTimestamp(timestamp string) {
	pageSize := 100
	cursor := ""
	hasMore := false
	for {
		rows, err := m.db.Query("SELECT timestamp from events WHERE timestamp > ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?", cursor, timestamp, pageSize+1)
		if err != nil {
			log.Printf("[WS Error] Failed to query events: %v", err)
			return
		}
		timestamps := []string{}
		for rows.Next() {
			var timestamp string
			err := rows.Scan(&timestamp)
			if err != nil {
				log.Printf("[WS Error] Failed to scan timestamp: %v", err)
				return
			}
			timestamps = append(timestamps, timestamp)
		}
		hasMore = len(timestamps) > pageSize
		if hasMore {
			timestamps = timestamps[:pageSize]
		}
		cursor = timestamps[len(timestamps)-1]
		m.addSendTimestamp(timestamps)
		if !hasMore {
			break
		}
	}
}

// marshalMessage serializes an outbound wire message, logging on failure.
func marshalMessage(msg proto.Message) []byte {
	data, err := proto.Marshal(msg)
	if err != nil {
		log.Printf("[WS Marshal] failed: %v", err)
		return nil
	}
	return data
}
