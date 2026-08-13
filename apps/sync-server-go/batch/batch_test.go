package batch

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// awaitFlush waits for n flushes to be observed by the batcher.
func awaitFlush(t *testing.T, got *atomic.Int32, want int32) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if got.Load() >= want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %d flushes, got %d", want, got.Load())
}

func TestBatcherFlushesOnMaxSize(t *testing.T) {
	flushed := make(chan []string, 1)
	b := NewBatcher(3, time.Minute, func(items []string) {
		select {
		case flushed <- items:
		default:
		}
	})
	for range 3 {
		b.Add("x")
	}
	select {
	case items := <-flushed:
		if len(items) != 3 {
			t.Fatalf("expected batch of 3, got %d", len(items))
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for maxSize flush")
	}
}

func TestBatcherFlushesAfterWait(t *testing.T) {
	var mu sync.Mutex
	var batches [][]string
	flushed := make(chan []string, 1)
	b := NewBatcher(100, 50*time.Millisecond, func(items []string) {
		mu.Lock()
		batches = append(batches, items)
		mu.Unlock()
		select {
		case flushed <- items:
		default:
		}
	})
	b.Add("a")
	b.Add("b")
	select {
	case items := <-flushed:
		if len(items) != 2 || items[0] != "a" || items[1] != "b" {
			t.Fatalf("unexpected batch: %v", items)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for timer flush")
	}
}

func TestBatcherTimerResetsPerBatch(t *testing.T) {
	// After a timer flush, the next item starts a fresh window: adding one
	// item after the flush must still flush after wait.
	var mu sync.Mutex
	count := 0
	b := NewBatcher(100, 40*time.Millisecond, func(items []string) {
		mu.Lock()
		count += len(items)
		mu.Unlock()
	})
	b.Add("1")
	time.Sleep(80 * time.Millisecond)
	b.Add("2")
	time.Sleep(80 * time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	if count != 2 {
		t.Fatalf("expected both items flushed, count = %d", count)
	}
}

func TestBatcherFlush(t *testing.T) {
	flushed := make(chan []string, 1)
	b := NewBatcher(100, time.Hour, func(items []string) {
		select {
		case flushed <- items:
		default:
		}
	})
	b.Add("a")
	b.Add("b")
	b.Flush()
	select {
	case items := <-flushed:
		if len(items) != 2 || items[0] != "a" || items[1] != "b" {
			t.Fatalf("unexpected batch: %v", items)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for Flush")
	}
	// Flush with nothing pending must not call the flush function.
	b.Flush()
	time.Sleep(20 * time.Millisecond)
	select {
	case items := <-flushed:
		t.Fatalf("expected no extra flush, got %v", items)
	default:
	}
}

func TestBatcherCancelDropsPending(t *testing.T) {
	var mu sync.Mutex
	count := 0
	b := NewBatcher(100, 20*time.Millisecond, func(items []string) {
		mu.Lock()
		count += len(items)
		mu.Unlock()
	})
	b.Add("a")
	b.Cancel()
	b.Add("b") // ignored after cancel
	time.Sleep(60 * time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	if count != 0 {
		t.Fatalf("expected no flushes after cancel, got %d", count)
	}
}

func TestDebouncerCoalesces(t *testing.T) {
	var calls atomic.Int32
	d := NewDebouncer(30*time.Millisecond, func() { calls.Add(1) })
	for range 5 {
		d.MaybeExecute()
		time.Sleep(5 * time.Millisecond)
	}
	awaitFlush(t, &calls, 1)
	if calls.Load() != 1 {
		t.Fatalf("expected exactly 1 call, got %d", calls.Load())
	}
}

func TestDebouncerFlush(t *testing.T) {
	var calls atomic.Int32
	d := NewDebouncer(time.Hour, func() { calls.Add(1) })
	d.MaybeExecute()
	d.Flush()
	awaitFlush(t, &calls, 1)
	if calls.Load() != 1 {
		t.Fatalf("expected exactly 1 call after Flush, got %d", calls.Load())
	}
	// Flush with no pending timer must not call.
	d.Flush()
	time.Sleep(20 * time.Millisecond)
	if calls.Load() != 1 {
		t.Fatalf("expected no extra call, got %d", calls.Load())
	}
}

func TestDebouncerCancel(t *testing.T) {
	var calls atomic.Int32
	d := NewDebouncer(20*time.Millisecond, func() { calls.Add(1) })
	d.MaybeExecute()
	d.Cancel()
	time.Sleep(60 * time.Millisecond)
	if calls.Load() != 0 {
		t.Fatalf("expected no calls after cancel, got %d", calls.Load())
	}
}
