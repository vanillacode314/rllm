import { describe, expect, it } from 'vitest';

import { ObjectPool } from '../src';

describe('ObjectPool', () => {
  it('creates and retrieves objects', async () => {
    const pool = new ObjectPool(() => ({ id: 1 }), 5);
    const obj = await pool.get();
    expect(pool.total).toBe(1);
    expect(obj).toEqual({ id: 1 });
    pool.destroy();
  });

  it('reuses objects', async () => {
    const pool = new ObjectPool(() => ({ id: 1 }), 5);
    const o1 = await pool.get();
    pool.release(o1);
    const o2 = await pool.get();
    expect(o1).toBe(o2);
    pool.destroy();
  });

  it('cannot be used after destroyed', async () => {
    const pool = new ObjectPool(() => ({ id: 1 }), 5);
    pool.destroy();
    await expect(pool.get()).rejects.toThrowError('Pool has been destroyed');
  });
});
