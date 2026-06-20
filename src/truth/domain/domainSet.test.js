import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NEGATIVE_INFINITY,
  POSITIVE_INFINITY,
  allReals,
  closedInterval,
  contains,
  createDomainSet,
  createInterval,
  emptySet,
  excludedPoints,
  halfOpenInterval,
  intersection,
  isAllReals,
  isEmpty,
  openInterval,
  removePoint,
  simplify,
  union,
} from './domainSet.js';
import { formatDomainSet } from './domainFormatter.js';

test('creates all real and empty domain sets', () => {
  assert.equal(isAllReals(allReals()), true);
  assert.equal(isEmpty(emptySet()), true);
  assert.deepEqual(allReals().intervals, [
    { from: NEGATIVE_INFINITY, to: POSITIVE_INFINITY, fromOpen: true, toOpen: true },
  ]);
});

test('contains respects open, closed, and half-open endpoints', () => {
  assert.equal(contains(openInterval(0, 2), 0), false);
  assert.equal(contains(openInterval(0, 2), 1), true);
  assert.equal(contains(openInterval(0, 2), 2), false);

  assert.equal(contains(closedInterval(0, 2), 0), true);
  assert.equal(contains(closedInterval(0, 2), 2), true);

  assert.equal(contains(halfOpenInterval(1, 3, { openSide: 'right' }), 1), true);
  assert.equal(contains(halfOpenInterval(1, 3, { openSide: 'right' }), 3), false);
});

test('union merges overlapping intervals', () => {
  const result = union(openInterval(0, 3), closedInterval(2, 5));

  assert.deepEqual(result.intervals, [
    { from: 0, to: 5, fromOpen: true, toOpen: false },
  ]);
});

test('union merges touching intervals when the shared endpoint is included', () => {
  const result = union(
    halfOpenInterval(0, 1, { openSide: 'left' }),
    openInterval(1, 2),
  );

  assert.deepEqual(result.intervals, [
    { from: 0, to: 2, fromOpen: true, toOpen: true },
  ]);
});

test('union does not merge touching intervals when the shared endpoint is excluded', () => {
  const result = union(openInterval(0, 1), openInterval(1, 2));

  assert.deepEqual(result.intervals, [
    { from: 0, to: 1, fromOpen: true, toOpen: true },
    { from: 1, to: 2, fromOpen: true, toOpen: true },
  ]);
});

test('intersection preserves endpoint openness correctly', () => {
  const result = intersection(closedInterval(0, 3), openInterval(1, 4));

  assert.deepEqual(result.intervals, [
    { from: 1, to: 3, fromOpen: true, toOpen: false },
  ]);
});

test('intersection returns a single point when both intervals include the touching endpoint', () => {
  const result = intersection(closedInterval(0, 1), closedInterval(1, 2));

  assert.deepEqual(result.intervals, [
    { from: 1, to: 1, fromOpen: false, toOpen: false },
  ]);
});

test('intersection returns empty when touching endpoint is excluded', () => {
  const result = intersection(openInterval(0, 1), closedInterval(1, 2));

  assert.equal(isEmpty(result), true);
});

test('removePoint splits all real numbers into two open intervals', () => {
  const result = removePoint(allReals(), 0);

  assert.deepEqual(result.intervals, [
    { from: NEGATIVE_INFINITY, to: 0, fromOpen: true, toOpen: true },
    { from: 0, to: POSITIVE_INFINITY, fromOpen: true, toOpen: true },
  ]);
  assert.deepEqual(excludedPoints(result), [0]);
});

test('removePoint handles interior and endpoint removal', () => {
  assert.deepEqual(removePoint(closedInterval(1, 3), 2).intervals, [
    { from: 1, to: 2, fromOpen: false, toOpen: true },
    { from: 2, to: 3, fromOpen: true, toOpen: false },
  ]);

  assert.deepEqual(removePoint(closedInterval(1, 3), 1).intervals, [
    { from: 1, to: 3, fromOpen: true, toOpen: false },
  ]);
});

test('simplify sorts intervals and removes invalid open point intervals', () => {
  const result = simplify(createDomainSet([
    createInterval(5, 6, { fromOpen: true, toOpen: true }),
    createInterval(1, 1, { fromOpen: true, toOpen: true }),
    createInterval(0, 2, { fromOpen: false, toOpen: false }),
    createInterval(2, 4, { fromOpen: false, toOpen: true }),
  ]));

  assert.deepEqual(result.intervals, [
    { from: 0, to: 4, fromOpen: false, toOpen: true },
    { from: 5, to: 6, fromOpen: true, toOpen: true },
  ]);
});

test('formatter separates mathematical representation from display output', () => {
  assert.equal(formatDomainSet(allReals()), 'R');
  assert.equal(formatDomainSet(emptySet()), '∅');
  assert.equal(formatDomainSet(removePoint(allReals(), 0)), 'R \\ {0}');
  assert.equal(
    formatDomainSet(removePoint(allReals(), 0), { preferExclusionNotation: false }),
    '(-∞,0) ∪ (0,∞)',
  );
  assert.equal(formatDomainSet(halfOpenInterval(1, 3, { openSide: 'right' })), '[1,3)');
  assert.equal(formatDomainSet(closedInterval(-3, 3)), '[-3,3]');
});

test('formatter displays unions of intervals', () => {
  const result = union(
    closedInterval(1, 3),
    openInterval(3, POSITIVE_INFINITY),
  );

  assert.equal(formatDomainSet(result), '[1,∞)');

  const separated = union(
    halfOpenInterval(1, 3, { openSide: 'right' }),
    openInterval(3, POSITIVE_INFINITY),
  );

  assert.equal(formatDomainSet(separated), '[1,3) ∪ (3,∞)');
});
