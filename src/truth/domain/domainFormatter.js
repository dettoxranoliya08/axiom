import {
  NEGATIVE_INFINITY,
  POSITIVE_INFINITY,
  excludedPoints,
  isAllReals,
  isEmpty,
} from './domainSet.js';

export function formatDomainSet(domainSet, { preferExclusionNotation = true } = {}) {
  if (isEmpty(domainSet)) return '∅';
  if (isAllReals(domainSet)) return 'R';

  const points = excludedPoints(domainSet);
  if (preferExclusionNotation && points.length > 0) {
    return `R \\ {${points.map(formatNumber).join(', ')}}`;
  }

  return domainSet.intervals.map(formatInterval).join(' ∪ ');
}

function formatInterval(interval) {
  const left = interval.fromOpen ? '(' : '[';
  const right = interval.toOpen ? ')' : ']';
  return `${left}${formatEndpoint(interval.from)},${formatEndpoint(interval.to)}${right}`;
}

function formatEndpoint(value) {
  if (value === NEGATIVE_INFINITY) return '-∞';
  if (value === POSITIVE_INFINITY) return '∞';
  return formatNumber(value);
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000000) / 1000000);
}
