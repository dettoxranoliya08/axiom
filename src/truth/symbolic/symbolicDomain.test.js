import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_TYPES } from '../models.js';
import { analyzeSymbolicDomain } from './symbolicDomain.js';

test('proves rational domain exclusions for simple denominators', () => {
  const oneOverX = analyzeSymbolicDomain('1/x');
  assert.equal(oneOverX.status, 'resolved');
  assert.equal(oneOverX.source.type, SOURCE_TYPES.SYMBOLIC_PROVEN);
  assert.deepEqual(oneOverX.value.excludedPoints, [0]);
  assert.equal(oneOverX.value.displayString, 'R \\ {0}');

  const shifted = analyzeSymbolicDomain('1/(x-2)');
  assert.equal(shifted.status, 'resolved');
  assert.deepEqual(shifted.value.excludedPoints, [2]);
  assert.equal(shifted.value.displayString, 'R \\ {2}');
});

test('proves rational domain exclusions for x squared minus a positive constant', () => {
  const claim = analyzeSymbolicDomain('(x+1)/(x^2-4)');

  assert.equal(claim.status, 'resolved');
  assert.equal(claim.source.type, SOURCE_TYPES.SYMBOLIC_PROVEN);
  assert.deepEqual(claim.value.excludedPoints, [-2, 2]);
  assert.equal(claim.value.displayString, 'R \\ {-2, 2}');
});

test('proves square-root domains for linear radicands', () => {
  assert.equal(analyzeSymbolicDomain('sqrt(x)').value.displayString, 'x >= 0');
  assert.equal(analyzeSymbolicDomain('sqrt(x-4)').value.displayString, 'x >= 4');
  assert.equal(analyzeSymbolicDomain('sqrt(4-x)').value.displayString, 'x <= 4');
});

test('proves logarithm domains for linear arguments', () => {
  assert.equal(analyzeSymbolicDomain('log(x)').value.displayString, 'x > 0');
  assert.equal(analyzeSymbolicDomain('log(x-3)').value.displayString, 'x > 3');
  assert.equal(analyzeSymbolicDomain('ln(x)').value.displayString, 'x > 0');
});

test('returns unknown instead of guessing for unsupported expressions', () => {
  const claim = analyzeSymbolicDomain('sin(x)');

  assert.equal(claim.status, 'unknown');
  assert.equal(claim.source.type, SOURCE_TYPES.UNKNOWN);
  assert.equal(claim.confidence.level, 'unknown');
  assert.equal(claim.confidence.score, 0);
  assert.equal(claim.warnings.length, 1);
});
