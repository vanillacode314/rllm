package pubsub

import (
	"log/slog"
	"runtime/debug"
	"slices"
	"sync"
)

type SubFunc[T any] func(v T)

type Subscription[T any] struct {
	Id    uint64
	topic string
	hub   *Hub[T]
}

func (s Subscription[T]) Unsubscribe() {
	if s.hub == nil {
		return
	}
	s.hub.mu.Lock()
	defer s.hub.mu.Unlock()

	if m := s.hub.subs[s.topic]; m != nil {
		delete(m, s.Id)
		if len(m) == 0 {
			delete(s.hub.subs, s.topic)
		}
	}
}

type Hub[T any] struct {
	mu     sync.RWMutex
	subs   map[string]map[uint64]SubFunc[T]
	nextID uint64
}

func NewHub[T any]() *Hub[T] {
	return &Hub[T]{
		subs: make(map[string]map[uint64]SubFunc[T]),
	}
}

func (h *Hub[T]) Subscribe(topic string, fn SubFunc[T]) *Subscription[T] {
	if fn == nil {
		return &Subscription[T]{}
	}

	h.mu.Lock()
	if h.subs == nil {
		h.subs = make(map[string]map[uint64]SubFunc[T])
	}
	if h.subs[topic] == nil {
		h.subs[topic] = make(map[uint64]SubFunc[T])
	}
	id := h.nextID
	h.nextID++
	h.subs[topic][id] = fn
	h.mu.Unlock()

	return &Subscription[T]{
		Id:    id,
		topic: topic,
		hub:   h,
	}
}

func (h *Hub[T]) Publish(topic string, v T, except ...uint64) {
	h.mu.RLock()
	subscribers := h.subs[topic]
	fns := make([]SubFunc[T], 0, len(subscribers))
	for id, fn := range subscribers {
		if slices.Contains(except, id) {
			continue
		}
		fns = append(fns, fn)
	}
	h.mu.RUnlock()

	for _, fn := range fns {
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("pubsub: panic in subscriber", "error", r)
					debug.PrintStack()
				}
			}()
			fn(v)
		}()
	}
}
