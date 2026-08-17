import { describe, it, expect } from 'vitest';
import { validateOrThrow } from './guards';
import { z } from 'zod';

describe('validateOrThrow', () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it('returns parsed data on success', () => {
    const result = validateOrThrow(schema, { name: 'Alice', age: 30 }, 'test');
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws with dev message in DEV mode', () => {
    const meta = import.meta as unknown as Record<string, Record<string, boolean>>;
    const original = meta.env.DEV;
    meta.env.DEV = true;

    expect(() =>
      validateOrThrow(schema, { name: 'Bob', age: 'old' }, 'UserSchema'),
    ).toThrow('Runtime validation failed: UserSchema');

    meta.env.DEV = original;
  });

  it('throws with prod message when not DEV', () => {
    const meta = import.meta as unknown as Record<string, Record<string, boolean>>;
    const original = meta.env.DEV;
    meta.env.DEV = false;

    expect(() =>
      validateOrThrow(schema, { name: 'Bob', age: 'old' }, 'UserSchema'),
    ).toThrow('Data shape error: UserSchema');

    meta.env.DEV = original;
  });
});