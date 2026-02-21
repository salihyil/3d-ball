import { describe, expect, it } from 'vitest';
import { add } from './math';

describe('Math functions', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });
});
