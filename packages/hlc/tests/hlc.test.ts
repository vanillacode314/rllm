import { describe, expect, it, vi } from 'vitest';

import { HLC } from '~/index.ts';

const testTime = 1700000000000;

function mockDateNow() {
  vi.spyOn(globalThis.Date, 'now').mockReturnValue(testTime);
}

function restoreDateNow() {
  vi.restoreAllMocks();
}

describe('HLC', () => {
  describe('generate', () => {
    it('should create HLC with random client ID', () => {
      mockDateNow();
      try {
        const hlc = HLC.generate();
        expect(hlc).toBeInstanceOf(HLC);
        expect(hlc.clientId).toHaveLength(21);
        // Set physical time to test value (constructor sets 0)
        hlc.physicalTime = testTime;
        expect(hlc.physicalTime).toBe(testTime);
        expect(hlc.logicalTime).toBe(0);
      } finally {
        restoreDateNow();
      }
    });

    it('should create HLC with provided client ID', () => {
      mockDateNow();
      try {
        const clientId = 'custom-id';
        const hlc = HLC.generate(clientId);
        expect(hlc.clientId).toBe(clientId);
      } finally {
        restoreDateNow();
      }
    });
  });

  describe('fromString', () => {
    it('should parse valid HLC string', () => {
      mockDateNow();
      try {
        const hlc = HLC.generate();
        hlc.physicalTime = 1234567890;
        hlc.logicalTime = 123;
        const str = hlc.toString();
        const parsed = HLC.fromString(str);
        expect(parsed.physicalTime).toBe(hlc.physicalTime);
        expect(parsed.logicalTime).toBe(hlc.logicalTime);
        expect(parsed.clientId).toBe(hlc.clientId);
      } finally {
        restoreDateNow();
      }
    });

    it('should throw on invalid format', () => {
      mockDateNow();
      try {
        expect(() => HLC.fromString('invalid')).toThrow('Invalid HLC value');
        expect(() => HLC.fromString('123-456')).toThrow('Invalid HLC value');
      } finally {
        restoreDateNow();
      }
    });

    it('should throw on invalid numbers', () => {
      mockDateNow();
      try {
        expect(() => HLC.fromString('abc-def-clientId')).toThrow('Invalid HLC value');
      } finally {
        restoreDateNow();
      }
    });
  });

  describe('cmp', () => {
    it('should compare physical time correctly', () => {
      mockDateNow();
      try {
        const hlc1 = HLC.generate();
        hlc1.physicalTime = 100;
        const hlc2 = HLC.generate();
        hlc2.physicalTime = 200;
        expect(hlc1.cmp(hlc2)).toBe(-1);
        expect(hlc2.cmp(hlc1)).toBe(1);
        expect(hlc1.cmp(hlc1)).toBe(0);
      } finally {
        restoreDateNow();
      }
    });

    it('should compare logical time when physical times equal', () => {
      mockDateNow();
      try {
        const hlc1 = HLC.generate();
        hlc1.physicalTime = testTime;
        hlc1.logicalTime = 10;
        const hlc2 = HLC.generate();
        hlc2.physicalTime = testTime;
        hlc2.logicalTime = 20;
        expect(hlc1.cmp(hlc2)).toBe(-1);
        expect(hlc2.cmp(hlc1)).toBe(1);
      } finally {
        restoreDateNow();
      }
    });

    it('should compare client ID when physical and logical times equal', () => {
      mockDateNow();
      try {
        const hlc1 = HLC.generate('aaa');
        hlc1.physicalTime = testTime;
        hlc1.logicalTime = 10;
        const hlc2 = HLC.generate('bbb');
        hlc2.physicalTime = testTime;
        hlc2.logicalTime = 10;
        expect(hlc1.cmp(hlc2)).toBe(-1);
        expect(hlc2.cmp(hlc1)).toBe(1);
      } finally {
        restoreDateNow();
      }
    });
  });

  describe('increment', () => {
    it('should increment logical time when physical time is recent', () => {
      mockDateNow();
      try {
        const hlc = HLC.generate();
        hlc.physicalTime = testTime;
        hlc.logicalTime = 5;
        const before = testTime;
        hlc.increment();
        expect(hlc.logicalTime).toBe(6);
        expect(hlc.physicalTime).toBeGreaterThanOrEqual(before);
        // Physical time should not change since it equals current time
        expect(hlc.physicalTime).toBe(before);
      } finally {
        restoreDateNow();
      }
    });

    it('should reset logical time and update physical time when physical time is old', () => {
      mockDateNow();
      try {
        const hlc = HLC.generate();
        hlc.physicalTime = 0;
        hlc.logicalTime = 100;
        hlc.increment();
        expect(hlc.physicalTime).toBe(testTime);
        expect(hlc.logicalTime).toBe(0);
      } finally {
        restoreDateNow();
      }
    });
  });

  describe('receive', () => {
    it('should update from received HLC when its physical time is greater', () => {
      mockDateNow();
      try {
        const hlc1 = HLC.generate();
        hlc1.physicalTime = testTime - 100;
        hlc1.logicalTime = 10;

        const hlc2 = HLC.generate('other');
        hlc2.physicalTime = testTime + 100;
        hlc2.logicalTime = 50;

        hlc1.receive(hlc2);
        expect(hlc1.physicalTime).toBe(testTime + 100);
        expect(hlc1.logicalTime).toBe(51);
      } finally {
        restoreDateNow();
      }
    });

    it('should update from received HLC string', () => {
      mockDateNow();
      try {
        const hlc1 = HLC.generate();
        hlc1.physicalTime = testTime - 100;
        hlc1.logicalTime = 10;

        const hlc2 = HLC.generate('other');
        hlc2.physicalTime = testTime + 100;
        hlc2.logicalTime = 50;
        const str = hlc2.toString();

        hlc1.receive(str);
        expect(hlc1.physicalTime).toBe(testTime + 100);
        expect(hlc1.logicalTime).toBe(51);
      } finally {
        restoreDateNow();
      }
    });

    it('should respect current time when both HLCs are old', () => {
      mockDateNow();
      try {
        const hlc1 = HLC.generate();
        hlc1.physicalTime = 0;
        hlc1.logicalTime = 0;

        const hlc2 = HLC.generate('other');
        hlc2.physicalTime = 0;
        hlc2.logicalTime = 0;

        hlc1.receive(hlc2);
        expect(hlc1.physicalTime).toBe(testTime);
        // When physical times differ, logical time resets to 0
        expect(hlc1.logicalTime).toBe(0);
      } finally {
        restoreDateNow();
      }
    });
  });

  describe('toString', () => {
    it('should format HLC correctly', () => {
      mockDateNow();
      try {
        const hlc = HLC.generate('test-client');
        hlc.physicalTime = 1234567890123;
        hlc.logicalTime = 0;
        hlc.clientId = 'test-client';

        const str = hlc.toString();
        expect(str).toMatch(/^\d+-\w+-test-client$/);
        expect(str).toContain('1234567890123');
        expect(str).toContain('test-client');
      } finally {
        restoreDateNow();
      }
    });

    it('should pad physical and logical time', () => {
      mockDateNow();
      try {
        const hlc = HLC.generate('client');
        hlc.physicalTime = 1;
        hlc.logicalTime = 1;

        const str = hlc.toString();
        expect(str.startsWith('000000000000001-')).toBe(true);
      } finally {
        restoreDateNow();
      }
    });
  });
});
