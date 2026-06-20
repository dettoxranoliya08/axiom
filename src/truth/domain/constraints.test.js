import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSTRAINT_TYPES,
  greaterThanOrEqualZeroConstraint,
  greaterThanZeroConstraint,
  notEqualConstraint,
} from './constraints.js';

test('represents point exclusion constraints', () => {
  assert.deepEqual(notEqualConstraint({ value: 2 }), {
    type: CONSTRAINT_TYPES.NOT_EQUAL,
    variable: 'x',
    expression: 'x',
    value: 2,
    display: 'x != 2',
  });
});

test('represents non-negative expression constraints', () => {
  assert.deepEqual(greaterThanOrEqualZeroConstraint({ expression: 'x - 4' }), {
    type: CONSTRAINT_TYPES.GREATER_THAN_OR_EQUAL_ZERO,
    expression: 'x - 4',
    value: 0,
    display: 'x - 4 >= 0',
  });
});

test('represents positive expression constraints', () => {
  assert.deepEqual(greaterThanZeroConstraint({ expression: 'x - 3' }), {
    type: CONSTRAINT_TYPES.GREATER_THAN_ZERO,
    expression: 'x - 3',
    value: 0,
    display: 'x - 3 > 0',
  });
});
