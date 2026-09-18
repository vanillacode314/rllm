package socket

import (
	"context"
	"fmt"
	"log/slog"
	"proto/peerspb"
	sigcrypto "sync-server/crypto"
	"sync-server/db"
	"sync-server/digest"
)

type EventReconciliationPlugin struct {
	transport Transport
	db        *db.DbClient
}

func NewEventReconciliationPlugin(db *db.DbClient) *EventReconciliationPlugin {
	return &EventReconciliationPlugin{db: db}
}

func (p *EventReconciliationPlugin) AttachTransport(transport Transport) {
	p.transport = transport
}

func (p *EventReconciliationPlugin) Handle(ctx context.Context, message *peerspb.PeerMessagePayload, accountId string, remotePeerId string, id string) error {
	{
		payload, ok := message.Payload.(*peerspb.PeerMessagePayload_Handshake)
		if ok {
			if capabilities := payload.Handshake.GetCapabilities(); capabilities != nil && capabilities.EventReconciliation && id > remotePeerId {
				if err := p.transport.Send(ctx, digestQueries(0, [][]uint32{{}})); err != nil {
					return fmt.Errorf("failed to send digest queries: %w", err)
				}
			}
			return nil
		}
	}
	payload, ok := message.Payload.(*peerspb.PeerMessagePayload_EventReconciliation)
	if !ok {
		return nil
	}
	switch payload := payload.EventReconciliation.Message.(type) {
	case *peerspb.EventReconciliationMessage_DigestQueries:
		queries := payload.DigestQueries
		slog.InfoContext(ctx, "digest queries", "accountId", accountId, "depth", queries.GetMerkleDepth(), "queries", len(queries.GetQueries()))
		tree, err := p.db.GetMerkleTreeByAccountId(ctx, accountId)
		if err != nil {
			return fmt.Errorf("failed to load tree: %w", err)
		}
		updates := digest.HandleDigestQuery(tree, queries.GetMerkleDepth(), queries.GetQueries())
		if err := p.transport.Send(ctx, digestUpdates(tree.MaxDepth(), updates)); err != nil {
			return fmt.Errorf("failed to send digest updates: %w", err)
		}
		return nil

	case *peerspb.EventReconciliationMessage_DigestUpdates:
		updates := payload.DigestUpdates
		slog.InfoContext(ctx, "digest updates", "accountId", accountId, "depth", updates.GetMerkleDepth(), "updates", len(updates.GetUpdates()))
		tree, err := p.db.GetMerkleTreeByAccountId(ctx, accountId)
		if err != nil {
			return fmt.Errorf("failed to load tree: %w", err)
		}
		action := digest.HandleDigestUpdate(tree, updates.GetMerkleDepth(), updates.GetUpdates())
		if action == nil {
			return nil
		}
		switch action.Kind {
		case digest.KindQueryChildren:
			if err := p.transport.Send(ctx, digestQueries(tree.MaxDepth(), action.Children)); err != nil {
				return fmt.Errorf("failed to send digest queries: %w", err)
			}
		case digest.KindAskTimestamp:
			if err := p.transport.Send(ctx, sendEventsAfterTimestamp(action.Timestamp)); err != nil {
				return fmt.Errorf("failed to send send events after timestamp: %w", err)
			}
			evts, err := p.db.GetMessagesAfterTimestamp(ctx, accountId, action.Timestamp)
			if err != nil {
				return fmt.Errorf("failed to get messages after timestamp: %w", err)
			}
			if err := p.transport.Send(ctx, events(evts)); err != nil {
				return fmt.Errorf("failed to send events: %w", err)
			}
		}
		return nil

	case *peerspb.EventReconciliationMessage_SendEventsAfterTimestamp:
		timestamp := payload.SendEventsAfterTimestamp.GetTimestamp()
		slog.InfoContext(ctx, "send events after timestamp", "accountId", accountId, "timestamp", timestamp)
		messages, err := p.db.GetMessagesAfterTimestamp(ctx, accountId, timestamp)
		if err != nil {
			return fmt.Errorf("failed to get messages after timestamp: %w", err)
		}
		if err := p.transport.Send(ctx, events(messages)); err != nil {
			return fmt.Errorf("failed to send events: %w", err)
		}
		return nil

	case *peerspb.EventReconciliationMessage_Events:
		evts := payload.Events.Events
		slog.InfoContext(ctx, "events", "accountId", accountId, "remotePeerId", remotePeerId, "events", len(evts))
		messages := make([]db.Message, 0, len(evts))
		for _, event := range evts {
			if !sigcrypto.VerifyData(event.GetData(), event.GetSignature(), accountId) {
				return fmt.Errorf("signature verification failed: accountId=%s", accountId)
			}
			messages = append(messages, db.Message{Data: event.GetData(), Signature: event.GetSignature(), Timestamp: event.GetTimestamp()})
		}
		nInserted, err := p.db.ReceiveMessages(ctx, accountId, remotePeerId, messages)
		if err != nil {
			return fmt.Errorf("failed to insert messages: %w", err)
		}
		slog.InfoContext(ctx, "inserted messages", "accountId", accountId, "nInserted", nInserted)
		if err := p.db.RecomputeMerkleTree(ctx, accountId); err != nil {
			return fmt.Errorf("failed to recompute merkle tree: %w", err)
		}
		slog.InfoContext(ctx, "recomputed merkle tree", "accountId", accountId)
		if err := p.transport.Publish(ctx, events(messages), "events"); err != nil {
			return fmt.Errorf("failed to send events: %w", err)
		}
		return nil

	default:
		return fmt.Errorf("unexpected message type %T", payload)
	}
}

func digestQueries(maxDepth int, paths [][]uint32) *peerspb.PeerMessagePayload {
	queries := make([]*peerspb.DigestQuery, len(paths))
	for i, path := range paths {
		queries[i] = &peerspb.DigestQuery{
			Path: path,
		}
	}
	return &peerspb.PeerMessagePayload{
		Payload: &peerspb.PeerMessagePayload_EventReconciliation{
			EventReconciliation: &peerspb.EventReconciliationMessage{
				Message: &peerspb.EventReconciliationMessage_DigestQueries{
					DigestQueries: &peerspb.DigestQueries{
						MerkleDepth: uint32(maxDepth),
						Queries:     queries,
					},
				},
			},
		},
	}
}

func sendEventsAfterTimestamp(timestamp string) *peerspb.PeerMessagePayload {
	return &peerspb.PeerMessagePayload{
		Payload: &peerspb.PeerMessagePayload_EventReconciliation{
			EventReconciliation: &peerspb.EventReconciliationMessage{
				Message: &peerspb.EventReconciliationMessage_SendEventsAfterTimestamp{
					SendEventsAfterTimestamp: &peerspb.SendEventsAfterTimestamp{
						Timestamp: timestamp,
					},
				},
			},
		},
	}
}

func digestUpdates(maxDepth int, updates []*peerspb.DigestUpdate) *peerspb.PeerMessagePayload {
	return &peerspb.PeerMessagePayload{
		Payload: &peerspb.PeerMessagePayload_EventReconciliation{
			EventReconciliation: &peerspb.EventReconciliationMessage{
				Message: &peerspb.EventReconciliationMessage_DigestUpdates{
					DigestUpdates: &peerspb.DigestUpdates{
						MerkleDepth: uint32(maxDepth),
						Updates:     updates,
					},
				},
			},
		},
	}
}

func events(events []db.Message) *peerspb.PeerMessagePayload {
	payloadEvents := make([]*peerspb.Event, len(events))
	for i, event := range events {
		payloadEvents[i] = &peerspb.Event{
			Data:      event.Data,
			Signature: event.Signature,
			Timestamp: event.Timestamp,
		}
	}
	return &peerspb.PeerMessagePayload{
		Payload: &peerspb.PeerMessagePayload_EventReconciliation{
			EventReconciliation: &peerspb.EventReconciliationMessage{
				Message: &peerspb.EventReconciliationMessage_Events{
					Events: &peerspb.Events{
						Events: payloadEvents,
					},
				},
			},
		},
	}
}
