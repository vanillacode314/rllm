package pubsub

import (
	"slices"
	"sync"
	"sync/atomic"
	"testing"
)

func TestPublishDeliversValueSynchronously(t *testing.T) {
	h := NewHub[int]()
	var got []int

	h.Subscribe("t", func(v int) { got = append(got, v) })

	h.Publish("t", 1)
	if want := []int{1}; !slices.Equal(got, want) {
		t.Fatalf("after first publish: got %v, want %v", got, want)
	}
	h.Publish("t", 2)
	if want := []int{1, 2}; !slices.Equal(got, want) {
		t.Fatalf("after second publish: got %v, want %v", got, want)
	}
}

func TestPublishReachesEverySubscriberOnTopic(t *testing.T) {
	h := NewHub[string]()
	const n = 5

	var mu sync.Mutex
	seen := make(map[int][]string)
	for i := range n {
		h.Subscribe("t", func(v string) {
			mu.Lock()
			defer mu.Unlock()
			seen[i] = append(seen[i], v)
		})
	}

	h.Publish("t", "x")

	for i := range n {
		if want := []string{"x"}; !slices.Equal(seen[i], want) {
			t.Errorf("subscriber %d: got %v, want %v", i, seen[i], want)
		}
	}
}

func TestPublishOnlyReachesMatchingTopic(t *testing.T) {
	h := NewHub[int]()
	var a, b int

	h.Subscribe("a", func(int) { a++ })
	h.Subscribe("b", func(int) { b++ })

	h.Publish("a", 1)
	if a != 1 || b != 0 {
		t.Fatalf("after publishing to a: a=%d b=%d, want a=1 b=0", a, b)
	}
	h.Publish("b", 2)
	if a != 1 || b != 1 {
		t.Fatalf("after publishing to b: a=%d b=%d, want a=1 b=1", a, b)
	}
}

func TestPublishWithoutSubscribersIsNoop(t *testing.T) {
	h := NewHub[int]()

	h.Publish("nobody-listens", 1)

	h.Subscribe("t", func(int) {})
	h.Publish("other-topic", 2)
}

func TestUnsubscribeStopsDelivery(t *testing.T) {
	h := NewHub[int]()
	var kept, dropped int

	h.Subscribe("t", func(int) { kept++ })
	unsubscribe := h.Subscribe("t", func(int) { dropped++ })

	h.Publish("t", 1)
	unsubscribe()
	h.Publish("t", 2)

	if kept != 2 || dropped != 1 {
		t.Fatalf("kept=%d dropped=%d, want kept=2 dropped=1", kept, dropped)
	}
}

func TestUnsubscribeIsIdempotent(t *testing.T) {
	h := NewHub[int]()
	var calls int

	unsubscribe := h.Subscribe("t", func(int) { calls++ })
	unsubscribe()
	unsubscribe()
	unsubscribe()

	h.Publish("t", 1)
	if calls != 0 {
		t.Fatalf("calls=%d, want 0", calls)
	}
}

func TestSubscribeNilFuncIsNoop(t *testing.T) {
	h := NewHub[int]()

	unsubscribe := h.Subscribe("t", nil)
	if unsubscribe == nil {
		t.Fatal("unsubscribe func is nil")
	}

	h.Publish("t", 1)
	unsubscribe()
}

func TestTopicReusableAfterAllSubscribersLeave(t *testing.T) {
	h := NewHub[int]()
	var first, second int

	unsubscribe := h.Subscribe("t", func(int) { first++ })
	h.Publish("t", 1)
	unsubscribe()

	h.Subscribe("t", func(int) { second++ })
	h.Publish("t", 2)

	if first != 1 || second != 1 {
		t.Fatalf("first=%d second=%d, want first=1 second=1", first, second)
	}
}

// Publish operates on a snapshot: subscriptions added mid-publish do not see the
// in-flight value, and unsubscriptions take effect only for later publishes.
func TestPublishUsesSnapshotOfSubscribers(t *testing.T) {
	h := NewHub[int]()
	var a, d, b []int

	var unsubscribeA func()
	unsubscribeA = h.Subscribe("t", func(v int) {
		a = append(a, v)
		if unsubscribeA != nil {
			h.Subscribe("t", func(v int) { b = append(b, v) })
			unsubscribeA()
			unsubscribeA = nil
		}
	})
	h.Subscribe("t", func(v int) { d = append(d, v) })

	h.Publish("t", 1)
	if want := []int{1}; !slices.Equal(a, want) {
		t.Fatalf("subscriber a: got %v, want %v", a, want)
	}
	if len(b) != 0 {
		t.Fatalf("subscriber added during publish received in-flight value: %v", b)
	}
	if want := []int{1}; !slices.Equal(d, want) {
		t.Fatalf("subscriber d: got %v, want %v", d, want)
	}

	h.Publish("t", 2)
	if want := []int{1}; !slices.Equal(a, want) {
		t.Fatalf("unsubscribed a received later publish: %v", a)
	}
	if want := []int{2}; !slices.Equal(b, want) {
		t.Fatalf("subscriber b: got %v, want %v", b, want)
	}
	if want := []int{1, 2}; !slices.Equal(d, want) {
		t.Fatalf("subscriber d: got %v, want %v", d, want)
	}
}

// Concurrent subscribe/publish/unsubscribe is race-free, and once every
// unsubscribe has returned and in-flight publishes have drained, delivery stops.
func TestConcurrentPublishAndUnsubscribe(t *testing.T) {
	h := NewHub[int]()
	const n = 32

	counts := make([]atomic.Int64, n)
	unsubscribes := make([]func(), n)

	for i := range n {
		unsubscribes[i] = h.Subscribe("t", func(int) { counts[i].Add(1) })
	}

	var wg sync.WaitGroup
	var remaining atomic.Int64
	var done atomic.Bool
	remaining.Store(n)

	const publishers = 4
	for range publishers {
		wg.Go(func() {
			for !done.Load() {
				h.Publish("t", 1)
			}
		})
	}
	for i := range n {
		wg.Go(func() {
			unsubscribes[i]()
			if remaining.Add(-1) == 0 {
				done.Store(true)
			}
		})
	}

	wg.Wait()

	h.Publish("t", 1)
	before := make([]int64, n)
	for i := range n {
		before[i] = counts[i].Load()
	}
	h.Publish("t", 1)
	for i := range n {
		if got := counts[i].Load(); got != before[i] {
			t.Fatalf("subscriber %d received value after unsubscribe: %d -> %d", i, before[i], got)
		}
	}
}
