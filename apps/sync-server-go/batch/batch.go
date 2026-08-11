// Package batch provides the batching primitives used by the sync socket
// connection manager, mirroring @tanstack/pacer's Batcher and Debouncer.
package batch

import (
	"sync"
	"time"
)

// Batcher accumulates items and flushes them as a batch when either maxSize
// is reached or wait elapses since the first item of the current batch. Flushes run in a goroutine.
type Batcher[T any] struct {
	mu       sync.Mutex
	pending  []T
	maxSize  int
	wait     time.Duration
	flush    func([]T)
	timer    *time.Timer
	canceled bool
}

// NewBatcher creates a Batcher that flushes via flush when a batch completes.
func NewBatcher[T any](maxSize int, wait time.Duration, flush func([]T)) *Batcher[T] {
	return &Batcher[T]{maxSize: maxSize, wait: wait, flush: flush}
}

// Add appends an item to the pending batch, flushing immediately when the
// batch reaches maxSize, otherwise arming a timer that fires wait after the
// first item of the batch.
func (b *Batcher[T]) Add(item T) {
	b.mu.Lock()
	if b.canceled {
		b.mu.Unlock()
		return
	}
	b.pending = append(b.pending, item)
	if len(b.pending) >= b.maxSize {
		b.mu.Unlock()
		b.flushPending()
		return
	}
	if b.timer == nil {
		b.timer = time.AfterFunc(b.wait, b.flushPending)
	}
	b.mu.Unlock()
}

// Cancel stops the timer and drops any pending items without flushing.
func (b *Batcher[T]) Cancel() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.canceled = true
	b.pending = nil
	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}
}

func (b *Batcher[T]) flushPending() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.canceled || len(b.pending) == 0 {
		return
	}
	items := b.pending
	b.pending = nil
	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}
	go b.flush(items)
}

// Debouncer executes fn wait after the last MaybeExecute call; Flush runs a
// pending execution immediately.
type Debouncer struct {
	mu         sync.Mutex
	wait       time.Duration
	fn         func()
	timer      *time.Timer
	generation int
	canceled   bool
}

// NewDebouncer creates a Debouncer that runs fn after the debounce window.
func NewDebouncer(wait time.Duration, fn func()) *Debouncer {
	return &Debouncer{wait: wait, fn: fn}
}

// MaybeExecute (re)arms the debounce timer.
func (d *Debouncer) MaybeExecute() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.canceled {
		return
	}
	if d.timer != nil {
		d.timer.Stop()
	}
	d.generation++
	gen := d.generation
	d.timer = time.AfterFunc(d.wait, func() { d.run(gen) })
}

// Flush executes fn now if a timer was pending.
func (d *Debouncer) Flush() {
	d.mu.Lock()
	hasPending := d.timer != nil
	if hasPending {
		d.timer.Stop()
		d.timer = nil
	}
	d.mu.Unlock()
	if hasPending {
		go d.fn()
	}
}

// Cancel stops the timer without executing.
func (d *Debouncer) Cancel() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.canceled = true
	if d.timer != nil {
		d.timer.Stop()
		d.timer = nil
	}
}

func (d *Debouncer) run(gen int) {
	d.mu.Lock()
	if d.generation == gen {
		d.timer = nil
	}
	d.mu.Unlock()
	d.fn()
}
