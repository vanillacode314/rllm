import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 21);

/**
 * Hybrid Logical Clock (HLC) implementation.
 *
 * This class provides a mechanism for generating and comparing timestamps
 * that are partially ordered, suitable for distributed systems. It combines
 * physical time with a logical counter to ensure causality.
 */
class HLC {
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

    return new HLC(physicalTime, logicalTime, id);
  }

  /**
   * Generates a new HLC instance with a given id, or a new random one.
   * The initial physical and logical times are set to 0.
   * @param id Optional ID. If not provided, a new one will be generated.
   * @returns A new HLC instance.
   */
  static generate(id?: string) {
    return new HLC(0, 0, id ?? nanoid());
  }

  /**
   * Compares this HLC with another HLC.
   * The comparison is based on physical time, then logical time, then ID.
   * @param other The HLC to compare with.
   * @returns -1 if this HLC is less than other, 1 if greater, 0 if equal.
   */
  cmp(other: HLC) {
    if (this.physicalTime < other.physicalTime) {
      return -1;
    } else if (this.physicalTime > other.physicalTime) {
      return 1;
    } else if (this.logicalTime < other.logicalTime) {
      return -1;
    } else if (this.logicalTime > other.logicalTime) {
      return 1;
    } else {
      return this.id.localeCompare(other.id);
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
   * @param other The HLC instance or its string representation received from another source.
   * @returns This HLC instance, after receiving and updating.
   */
  receive(other: HLC | string) {
    if (typeof other === 'string') {
      other = HLC.fromString(other);
    }
    const now = Date.now();
    const physicalTime = Math.max(this.physicalTime, other.physicalTime, now);
    if (physicalTime === this.physicalTime && physicalTime === other.physicalTime) {
      this.logicalTime = Math.max(this.logicalTime, other.logicalTime) + 1;
    } else if (physicalTime === this.physicalTime) {
      this.logicalTime = this.logicalTime + 1;
    } else if (physicalTime === other.physicalTime) {
      this.logicalTime = other.logicalTime + 1;
    } else {
      this.logicalTime = 0;
    }
    this.physicalTime = physicalTime;
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

export { HLC };
