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
	hasQueryBatch      *batch.Batcher[string]
	hasUpdateBatch     *batch.Batcher[string]
	recomputeDebouncer *batch.Debouncer
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
	m.hasQueryBatch = batch.NewBatcher(100, 5*time.Second, func(timestamps []string) { m.flushHasEventQuery(timestamps) })
	m.hasUpdateBatch = batch.NewBatcher(100, 5*time.Second, func(timestamps []string) { m.flushHasEventUpdate(timestamps) })
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
	m.hasQueryBatch.Cancel()
	m.hasUpdateBatch.Cancel()
	m.recomputeDebouncer.Flush()
}

func (m *ConnectionManager) sendTimestamp(timestamp string) {
	log.Printf("[WS Batcher] Adding timestamp: accountId=%s timestamp=%s", m.accountID, timestamp)
	m.sendTimestampBatch.Add(timestamp)
}

func (m *ConnectionManager) sendHasEventWithTimestampQuery(timestamp string) {
	m.hasQueryBatch.Add(timestamp)
}

func (m *ConnectionManager) sendHasEventWithTimestampUpdate(timestamp string) {
	m.hasUpdateBatch.Add(timestamp)
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

func (m *ConnectionManager) createHandshake(version string, rootDigest []byte) []byte {
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_Handshake{
			Handshake: &peers.SyncHandshake{Version: version, RootDigest: rootDigest},
		},
	})
}

func (m *ConnectionManager) createDigestQuery(merkleDepth uint32, paths [][]uint32) []byte {
	treePaths := make([]*peers.TreePath, 0, len(paths))
	for _, path := range paths {
		treePaths = append(treePaths, &peers.TreePath{Segments: path})
	}
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_DigestQuery{
			DigestQuery: &peers.MerkleDigestQuery{MerkleDepth: merkleDepth, Paths: treePaths},
		},
	})
}

func (m *ConnectionManager) createEventBatch(events []*peers.PeerEvent) []byte {
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_EventBatch{
			EventBatch: &peers.EventBatch{Events: events},
		},
	})
}

func (m *ConnectionManager) createHasEventWithTimestampQuery(timestamps []string) []byte {
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_HasEventWithTimestampQuery{
			HasEventWithTimestampQuery: &peers.HasEventWithTimestampQuery{Timestamps: timestamps},
		},
	})
}

func (m *ConnectionManager) createHasEventWithTimestampUpdates(updates []*peers.HasEventWithTimestampUpdate) []byte {
	return marshalMessage(&peers.SyncWireMessage{
		AccountId: m.accountID,
		ClientId:  m.clientID,
		Payload: &peers.SyncWireMessage_HasEventWithTimestampUpdates{
			HasEventWithTimestampUpdates: &peers.HasEventWithTimestampUpdates{Updates: updates},
		},
	})
}

// flushSendTimestamp sends stored events for the requested timestamps.
func (m *ConnectionManager) flushSendTimestamp(timestamps []string) {
	timestamps = digest.Unique(timestamps)
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
	peerEvents := make([]*peers.PeerEvent, 0, len(events))
	for _, event := range events {
		peerEvents = append(peerEvents, &peers.PeerEvent{
			Data:      event.Data,
			Signature: event.Signature,
			Timestamp: event.Timestamp,
		})
	}
	m.write(m.createEventBatch(peerEvents))
}

// flushHasEventQuery sends a hasEventWithTimestampQuery for the timestamps.
func (m *ConnectionManager) flushHasEventQuery(timestamps []string) {
	timestamps = digest.Unique(timestamps)
	m.write(m.createHasEventWithTimestampQuery(timestamps))
}

// flushHasEventUpdate answers hasEventWithTimestampQuery by checking the
// local merkle tree.
func (m *ConnectionManager) flushHasEventUpdate(timestamps []string) {
	tree, err := client.GetMerkleTreeByAccountId(m.db, m.accountID)
	if err != nil {
		log.Printf("[WS HasEventQueryBatch] Failed to load tree: %v", err)
		return
	}
	updates := make([]*peers.HasEventWithTimestampUpdate, 0, len(timestamps))
	for _, timestamp := range timestamps {
		yes := tree.GetIndexByMeta(timestamp, func(a, b string) int {
			switch {
			case a < b:
				return -1
			case a > b:
				return 1
			default:
				return 0
			}
		}) > -1
		updates = append(updates, &peers.HasEventWithTimestampUpdate{Timestamp: timestamp, Yes: yes})
	}
	log.Printf("[WS HasEventQueryBatch] accountId=%s updates=%d", m.accountID, len(updates))
	m.write(m.createHasEventWithTimestampUpdates(updates))
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
