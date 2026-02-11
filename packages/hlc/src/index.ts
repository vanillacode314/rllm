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
	clientId: string;
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
	 * @param clientId The unique client ID.
	 */
	constructor(physicalTime: number, logicalTime: number, clientId: string) {
		this.physicalTime = physicalTime;
		this.logicalTime = logicalTime;
		this.clientId = clientId;
	}

	/**
	 * Creates an HLC instance from its string representation.
	 * @param value The string representation of an HLC (e.g., "physicalTime-logicalTime-clientId").
	 * @returns A new HLC instance.
	 * @throws {Error} If the HLC value is invalid.
	 */
	static fromString(value: string) {
		const [physicalTime, logicalTime, ...rest] = value.split('-');
		if (physicalTime === undefined || logicalTime === undefined || rest.length === 0) {
			throw new Error(`Invalid HLC value: ${value}`);
		}
		const clientId = rest.join('');
		return new HLC(parseInt(physicalTime, 10), parseInt(logicalTime, 36), clientId);
	}

	/**
	 * Generates a new HLC instance with a given client ID, or a new random one.
	 * The initial physical and logical times are set to 0.
	 * @param clientId Optional client ID. If not provided, a new one will be generated.
	 * @returns A new HLC instance.
	 */
	static generate(clientId?: string) {
		return new HLC(0, 0, clientId ?? nanoid());
	}

	/**
	 * Compares this HLC with another HLC.
	 * The comparison is based on physical time, then logical time, then client ID.
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
			return this.clientId.localeCompare(other.clientId);
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
		if (physicalTime === this.physicalTime) {
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
	 * The format is "physicalTime-logicalTime-clientId".
	 * @returns The string representation of the HLC.
	 */
	toString() {
		return `${this.physicalTime.toString().padStart(15, '0')}-${this.logicalTime.toString(36).padStart(5, '0')}-${this.clientId}`;
	}
}

export { HLC };
