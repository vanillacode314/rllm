import { GCounter } from './crdts/g-counter';

/** A step in the tracking tree: the property key its object was reached through and the tracking node of its parent. */
type Node = { key?: PropertyKey; parent?: Node };

/**
 * The boundary captured when an array is entered while `treatArraysAsPrimitives`
 * is active. Mutations inside that array are reported as one replacement of
 * `value` at `key`, rather than as paths below it.
 */
type Root = { key: PropertyKey; node: Node; value: unknown };

/**
 * Wraps `target` in a deep-tracking proxy and reports mutations with the
 * property path they occurred at.
 *
 * Object reads return nested tracked proxies memoized per `target` (shared
 * `cache`), so every callback sees a path relative to the original object.
 * Assigning a tracked proxy into another tracked object stores the raw target
 * instead of the proxy (resolved through `inverseCache`).
 *
 * @param target Object or array to track; `null` is returned as-is.
 * @param opts Tracking options shared with every nested proxy created from this one.
 * @param opts.cache Memoized `target -> proxy` map; one map serves the whole tree.
 * @param opts.inverseCache `proxy -> target` map used to unwrap proxies on assignment.
 * @param opts.key Property key the current object was reached through.
 * @param opts.onAdd Fires when a new property is created.
 * @param opts.onRemove Fires when an existing property is deleted.
 * @param opts.onReplace Fires when an existing property is assigned a value that differs (`Object.is`) from the current one; also used for whole-root replacements, including deleting the root property.
 * @param opts.parent Tracking node of the enclosing object.
 * @param opts.root Boundary captured by an ancestor when arrays are treated as primitives.
 * @param opts.treatArraysAsPrimitives When true, arrays are opaque: tracking stops inside them and any mutation within reports the whole array as replaced at its path.
 * @returns A tracked proxy for `target`.
 */
export function createTracked<T extends object>(
  target: T,
  opts: {
    cache?: WeakMap<object, object>;
    inverseCache?: WeakMap<object, object>;
    key?: PropertyKey;
    onAdd?(path: PropertyKey[], value: unknown): void;
    onRemove?(path: PropertyKey[]): void;
    onReplace?(path: PropertyKey[], value: unknown): void;
    parent?: Node;
    root?: Root;
    treatArraysAsPrimitives?: boolean;
  } = {}
): T {
  const {
    cache = new WeakMap(),
    inverseCache = new WeakMap(),
    key,
    onAdd,
    onRemove,
    onReplace,
    parent,
    root,
    treatArraysAsPrimitives = false
  } = opts;
  if (target === null) return target;
  if (cache?.has(target)) return cache.get(target) as T;
  const node = { key, parent };
  const proxy = new Proxy(target, {
    deleteProperty(target, key) {
      const existed = Object.hasOwn(target, key);
      const ok = Reflect.deleteProperty(target, key);
      if (!ok || !existed) return ok;
      if (root) onReplace?.(pathOf(root.node, root.key), root.value);
      else onRemove?.(pathOf(node, key));
      return ok;
    },
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (!isObject(value) && !Array.isArray(value)) {
        if (value instanceof GCounter) {
          value.onChange(() => {
            onReplace?.(pathOf(node, key), value);
          });
        }
        return value;
      }
      const cached = cache.get(value);
      if (cached) return cached;
      const arrayCase = treatArraysAsPrimitives && Array.isArray(value);
      return createTracked(value, {
        ...opts,
        cache,
        inverseCache,
        key,
        parent: node,
        root: arrayCase ? { key, node, value } : root,
        treatArraysAsPrimitives: arrayCase ? false : treatArraysAsPrimitives
      });
    },
    set(t, key, value, receiver) {
      const isNew = !Object.hasOwn(t, key);
      const old = Reflect.get(t, key, receiver);
      value = inverseCache.get(value) ?? value;
      if (!Reflect.set(t, key, value, receiver)) return false; // store RAW value
      const isReplaced = !Object.is(old, value);
      if (root && isReplaced) onReplace?.(pathOf(root.node, root.key), root.value);
      else if (isNew) onAdd?.(pathOf(node, key), value);
      else if (isReplaced) onReplace?.(pathOf(node, key), value);
      return true;
    }
  });
  cache.set(target, proxy);
  inverseCache.set(proxy, target);
  return proxy;
}

/**
 * Throws when `condition` is falsy; otherwise narrows `condition` to `true`
 * for the remainder of the calling scope.
 *
 * @param condition Condition that must hold.
 * @param message Error message used when the condition fails.
 * @throws If `condition` is falsy.
 */
export function invariant(
  condition: boolean,
  message: string = 'invariant failed'
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Checks that a value is a plain object: non-null and not an array.
 *
 * @param value Value to test.
 * @returns `true` when `value` is an object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Reconstructs the property path of a tracking-tree event.
 *
 * @param node Tracking node of the object that owns `key`.
 * @param key Property key that was added, replaced, or removed.
 * @returns Path segments from the outermost tracked object down to `key`.
 */
function pathOf(node: Node, key: PropertyKey): PropertyKey[] {
  const path = [] as PropertyKey[];
  path.unshift(key);
  while (node?.key !== undefined) {
    path.unshift(node.key!);
    node = node.parent!;
  }
  return path;
}
