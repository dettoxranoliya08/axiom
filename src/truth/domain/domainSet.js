export const NEGATIVE_INFINITY = '-inf';
export const POSITIVE_INFINITY = '+inf';

export function createInterval(from, to, { fromOpen = true, toOpen = true } = {}) {
  return {
    from,
    to,
    fromOpen: isNegativeInfinity(from) ? true : fromOpen,
    toOpen: isPositiveInfinity(to) ? true : toOpen,
  };
}

export function createDomainSet(intervals = []) {
  return {
    kind: 'domain_set',
    intervals: simplifyIntervals(intervals),
  };
}

export function allReals() {
  return createDomainSet([
    createInterval(NEGATIVE_INFINITY, POSITIVE_INFINITY),
  ]);
}

export function emptySet() {
  return createDomainSet([]);
}

export function openInterval(from, to) {
  return createDomainSet([createInterval(from, to, { fromOpen: true, toOpen: true })]);
}

export function closedInterval(from, to) {
  return createDomainSet([createInterval(from, to, { fromOpen: false, toOpen: false })]);
}

export function halfOpenInterval(from, to, { openSide }) {
  return createDomainSet([
    createInterval(from, to, {
      fromOpen: openSide === 'left',
      toOpen: openSide === 'right',
    }),
  ]);
}

export function union(left, right) {
  return createDomainSet([
    ...left.intervals,
    ...right.intervals,
  ]);
}

export function intersection(left, right) {
  const intervals = [];

  for (const a of left.intervals) {
    for (const b of right.intervals) {
      const overlap = intersectIntervals(a, b);
      if (overlap) intervals.push(overlap);
    }
  }

  return createDomainSet(intervals);
}

export function removePoint(domainSet, point) {
  const intervals = [];

  for (const current of domainSet.intervals) {
    if (!intervalContains(current, point)) {
      intervals.push(current);
      continue;
    }

    if (compareValues(current.from, point) < 0) {
      intervals.push(createInterval(current.from, point, {
        fromOpen: current.fromOpen,
        toOpen: true,
      }));
    }

    if (compareValues(point, current.to) < 0) {
      intervals.push(createInterval(point, current.to, {
        fromOpen: true,
        toOpen: current.toOpen,
      }));
    }
  }

  return createDomainSet(intervals);
}

export function contains(domainSet, point) {
  return domainSet.intervals.some((current) => intervalContains(current, point));
}

export function simplify(domainSet) {
  return createDomainSet(domainSet.intervals);
}

export function excludedPoints(domainSet) {
  const intervals = domainSet.intervals;
  if (intervals.length < 2) return [];
  if (!isNegativeInfinity(intervals[0].from)) return [];
  if (!isPositiveInfinity(intervals[intervals.length - 1].to)) return [];

  const points = [];

  for (let i = 0; i < intervals.length - 1; i++) {
    const left = intervals[i];
    const right = intervals[i + 1];

    if (
      compareValues(left.to, right.from) !== 0 ||
      !left.toOpen ||
      !right.fromOpen
    ) {
      return [];
    }

    points.push(left.to);
  }

  return points;
}

export function isEmpty(domainSet) {
  return domainSet.intervals.length === 0;
}

export function isAllReals(domainSet) {
  return (
    domainSet.intervals.length === 1 &&
    isNegativeInfinity(domainSet.intervals[0].from) &&
    isPositiveInfinity(domainSet.intervals[0].to)
  );
}

function simplifyIntervals(intervals) {
  const valid = intervals
    .filter(isValidInterval)
    .map((current) => createInterval(current.from, current.to, current))
    .sort(compareIntervalStart);

  const simplified = [];

  for (const current of valid) {
    const previous = simplified[simplified.length - 1];
    if (!previous || !canMerge(previous, current)) {
      simplified.push(current);
      continue;
    }

    simplified[simplified.length - 1] = mergeIntervals(previous, current);
  }

  return simplified;
}

function intersectIntervals(left, right) {
  const fromComparison = compareValues(left.from, right.from);
  const from = fromComparison > 0 ? left.from : right.from;
  const fromOpen = fromComparison > 0
    ? left.fromOpen
    : fromComparison < 0
      ? right.fromOpen
      : left.fromOpen || right.fromOpen;

  const toComparison = compareValues(left.to, right.to);
  const to = toComparison < 0 ? left.to : right.to;
  const toOpen = toComparison < 0
    ? left.toOpen
    : toComparison > 0
      ? right.toOpen
      : left.toOpen || right.toOpen;

  const candidate = createInterval(from, to, { fromOpen, toOpen });
  return isValidInterval(candidate) ? candidate : null;
}

function intervalContains(interval, point) {
  const afterStart = interval.fromOpen
    ? compareValues(point, interval.from) > 0
    : compareValues(point, interval.from) >= 0;
  const beforeEnd = interval.toOpen
    ? compareValues(point, interval.to) < 0
    : compareValues(point, interval.to) <= 0;

  return afterStart && beforeEnd;
}

function isValidInterval(interval) {
  const comparison = compareValues(interval.from, interval.to);
  if (comparison > 0) return false;
  if (comparison < 0) return true;
  return !interval.fromOpen && !interval.toOpen;
}

function compareIntervalStart(left, right) {
  const startComparison = compareValues(left.from, right.from);
  if (startComparison !== 0) return startComparison;
  if (left.fromOpen === right.fromOpen) return 0;
  return left.fromOpen ? 1 : -1;
}

function canMerge(left, right) {
  const comparison = compareValues(left.to, right.from);
  if (comparison > 0) return true;
  if (comparison < 0) return false;

  return !left.toOpen || !right.fromOpen;
}

function mergeIntervals(left, right) {
  const comparison = compareValues(left.to, right.to);
  if (comparison > 0) return left;
  if (comparison < 0) {
    return createInterval(left.from, right.to, {
      fromOpen: left.fromOpen,
      toOpen: right.toOpen,
    });
  }

  return createInterval(left.from, left.to, {
    fromOpen: left.fromOpen,
    toOpen: left.toOpen && right.toOpen,
  });
}

function compareValues(left, right) {
  const leftNumber = numericValue(left);
  const rightNumber = numericValue(right);
  if (leftNumber < rightNumber) return -1;
  if (leftNumber > rightNumber) return 1;
  return 0;
}

function numericValue(value) {
  if (isNegativeInfinity(value)) return Number.NEGATIVE_INFINITY;
  if (isPositiveInfinity(value)) return Number.POSITIVE_INFINITY;
  return value;
}

function isNegativeInfinity(value) {
  return value === NEGATIVE_INFINITY;
}

function isPositiveInfinity(value) {
  return value === POSITIVE_INFINITY;
}
