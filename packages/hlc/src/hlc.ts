import { nanoid } from 'nanoid';

/**
 * Hybrid Logical Clock (HLC) implementation.
 *
 * This class provides a mechanism for generating and comparing timestamps
 * that are partially ordered, suitable for distributed systems. It combines
 * physical time with a logical counter to ensure causality.
 */
export class HLC {
  /**
   * Unique identifier for the client generating this HLC.
   */
  id: string;
  /**
   * Logical time component. Increments when physical time does not advance.
   */
  logicalTime: number;
  /**
   * Physical time component (milliseconds since epoch).
   */
  physicalTime: number;

  /**
   * Creates an instance of HLC.
   * @param physicalTime The physical time component.
   * @param logicalTime The logical time component.
   * @param id The unique ID.
   */
  constructor(physicalTime: number, logicalTime: number, id: string) {
    if (id === '') throw new Error('id cannot be empty');
    this.physicalTime = physicalTime;
    this.logicalTime = logicalTime;
    this.id = id;
  }

  /**
   * Creates an HLC instance from its string representation.
   * The format is "physicalTime-logicalTime-id", where id is the remainder after the first two dashes.
   * @param value The string representation of an HLC.
   * @returns A new HLC instance.
   * @throws {Error} If the HLC value is invalid.
   */
  static fromString(value: string) {
    const [physicalTime, logicalTime, id] = parseString(value);
    return new HLC(physicalTime, logicalTime, id);
  }

  /**
   * Generates a new HLC instance with a given ID, or a new random one.
   * The initial physical and logical times are set to 0.
   * @param id Optional ID. If not provided, a new one will be generated.
   * @returns A new HLC instance.
   */
  static generate(id?: string) {
    return new HLC(0, 0, id ?? nanoid());
  }

  /**
   * Creates a clone of this HLC with an optional new ID.
   * @param id Optional new ID. If not provided, the original ID is used.
   * @returns A new HLC instance with the same physical and logical times.
   */
  clone(id?: string) {
    if (id === '') throw new Error('id cannot be empty');
    return new HLC(this.physicalTime, this.logicalTime, id ?? this.id);
  }

  /**
   * Compares this HLC with another HLC.
   * The comparison is based on physical time, then logical time, then ID.
   * @param other The HLC to compare with.
   * @returns -1 if this HLC is less than other, 1 if greater, 0 if equal.
   */
  cmp(other: HLC | string) {
    let id: string, logicalTime: number, physicalTime: number;
    if (typeof other === 'string') {
      [physicalTime, logicalTime, id] = parseString(other);
    } else {
      physicalTime = other.physicalTime;
      logicalTime = other.logicalTime;
      id = other.id;
    }
    if (this.physicalTime < physicalTime) {
      return -1;
    } else if (this.physicalTime > physicalTime) {
      return 1;
    } else if (this.logicalTime < logicalTime) {
      return -1;
    } else if (this.logicalTime > logicalTime) {
      return 1;
    } else {
      if (this.id > id) return 1;
      if (this.id < id) return -1;
      return 0;
    }
  }

  /**
   * Increments the HLC.
   * If the current physical time is less than the current system time,
   * the physical time is updated to the current system time and the logical time is reset to 0.
   * Otherwise, the logical time is incremented.
   * @returns This HLC instance, after incrementing.
   */
  increment() {
    const now = Date.now();
    if (this.physicalTime < now) {
      this.physicalTime = now;
      this.logicalTime = 0;
    } else {
      this.logicalTime++;
    }
    return this;
  }

  /**
   * Receives an HLC from another source and updates this HLC.
   * This method ensures that the local HLC's time is always equal to or greater than
   * both the received HLC's time and the current system time.
   * @param other The HLC or it's string representation received from another source.
   * @returns This HLC instance, after receiving and updating.
   */
  receive(other: HLC | string) {
    let logicalTime: number, physicalTime: number;
    if (typeof other === 'string') {
      [physicalTime, logicalTime] = parseString(other);
    } else {
      physicalTime = other.physicalTime;
      logicalTime = other.logicalTime;
    }
    const now = Date.now();
    const newPhysicalTime = Math.max(this.physicalTime, physicalTime, now);
    if (newPhysicalTime === this.physicalTime && newPhysicalTime === physicalTime) {
      this.logicalTime = Math.max(this.logicalTime, logicalTime) + 1;
    } else if (newPhysicalTime === this.physicalTime) {
      this.logicalTime = this.logicalTime + 1;
    } else if (newPhysicalTime === physicalTime) {
      this.logicalTime = logicalTime + 1;
    } else {
      this.logicalTime = 0;
    }
    this.physicalTime = newPhysicalTime;
    return this;
  }

  /**
   * Returns the string representation of this HLC.
   * The format is "physicalTime-logicalTime-id".
   * @returns The string representation of the HLC.
   */
  toString() {
    return `${this.physicalTime.toString().padStart(15, '0')}-${this.logicalTime.toString(36).padStart(5, '0')}-${this.id}`;
  }
}

function parseString(value: string): [number, number, string] {
  const dashIndices: number[] = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '-') dashIndices.push(i);
    if (dashIndices.length > 2) break;
  }

  if (dashIndices.length < 2) {
    throw new Error(`Invalid HLC value: ${value}`);
  }

  const physicalTimeStr = value.substring(0, dashIndices[0]!);
  const logicalTimeStr = value.substring(dashIndices[0]! + 1, dashIndices[1]!);
  const id = value.substring(dashIndices[1]! + 1);

  if (!physicalTimeStr || !logicalTimeStr || !id) {
    throw new Error(`Invalid HLC value: ${value}`);
  }

  const physicalTime = parseInt(physicalTimeStr, 10);
  const logicalTime = parseInt(logicalTimeStr, 36);

  if (isNaN(physicalTime) || isNaN(logicalTime)) {
    throw new Error(`Invalid HLC value: ${value}`);
  }
  return [physicalTime, logicalTime, id] as const;
}
