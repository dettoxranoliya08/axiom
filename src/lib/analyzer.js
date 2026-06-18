export function analyzeFunction(data) {
  const valid = data.filter(p => p.y !== null && isFinite(p.y));
  if (valid.length === 0) {
    return { error: 'No valid data points in this range' };
  }

  const yValues = valid.map(p => p.y);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const scale = Math.max(Math.abs(yMax), Math.abs(yMin), 1);
  const LARGE = scale * 0.15;

  // ==========================================
  // STEP 1: ASYMPTOTE & DISCONTINUITY DETECTION
  // ==========================================
  const verticalAsymptotes = [];
  const jumpDiscontinuities = [];
  const removableDiscontinuities = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const dx = Math.abs(curr.x - prev.x);

    const prevNull = prev.y === null || !isFinite(prev.y);
    const currNull = curr.y === null || !isFinite(curr.y);
    const prevLarge = !prevNull && Math.abs(prev.y) > LARGE;
    const currLarge = !currNull && Math.abs(curr.y) > LARGE;
    const prevSmall = !prevNull && Math.abs(prev.y) <= LARGE;
    const currSmall = !currNull && Math.abs(curr.y) <= LARGE;

    // Pattern 1: large+ → large- (opposite signs) = asymptote
    if (prevLarge && currLarge) {
      const oppSigns = (prev.y > 0 && curr.y < 0) || (prev.y < 0 && curr.y > 0);
      if (oppSigns) {
        verticalAsymptotes.push(Math.round(((prev.x + curr.x) / 2) * 10) / 10);
        continue;
      }
    }

    // Pattern 2: large → null = asymptote
    if (prevLarge && currNull) {
      verticalAsymptotes.push(Math.round(curr.x * 10) / 10);
      continue;
    }

    // Pattern 3: null → large = asymptote
    if (prevNull && currLarge) {
      verticalAsymptotes.push(Math.round(prev.x * 10) / 10);
      continue;
    }

    // Pattern 4: isolated null with similar neighbors = removable discontinuity
    if (i < data.length - 1) {
      const next = data[i + 1];
      const nextSmall = next.y !== null && isFinite(next.y) && Math.abs(next.y) <= LARGE;
      if (prevSmall && currNull && nextSmall) {
        if (Math.abs(prev.y - next.y) < scale * 0.05) {
          removableDiscontinuities.push(Math.round(curr.x * 10) / 10);
        }
      }
    }

    // Pattern 5: small → small, sudden jump = jump discontinuity
    if (prevSmall && currSmall) {
      const dy = Math.abs(curr.y - prev.y);
      const nearAsymptote = verticalAsymptotes.some(a => Math.abs(a - prev.x) < 0.3) ||
                            verticalAsymptotes.some(a => Math.abs(a - curr.x) < 0.3);
      if (dx < 0.15 && dy > scale * 0.08 && !nearAsymptote) {
        jumpDiscontinuities.push(Math.round(prev.x * 10) / 10);
      }
    }
  }

  const uniqueAsymptotes = [...new Set(verticalAsymptotes)];
  const uniqueJumps = [...new Set(jumpDiscontinuities)];
  const uniqueRemovable = [...new Set(removableDiscontinuities)];

  // ==========================================
  // STEP 2: INTERVALS - SAFE POINTS ONLY
  // ==========================================
  const intervals = [];
  let currentInterval = [];

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const next = i < data.length - 1 ? data[i + 1] : null;

    if (p.y === null || !isFinite(p.y)) {
      if (currentInterval.length > 1) intervals.push([...currentInterval]);
      currentInterval = [];
      continue;
    }

    if (Math.abs(p.y) > LARGE) {
      if (currentInterval.length > 1) intervals.push([...currentInterval]);
      currentInterval = [];
      continue;
    }

    const prevProblematic = prev && (prev.y === null || !isFinite(prev.y) || Math.abs(prev.y) > LARGE);
    const nextProblematic = next && (next.y === null || !isFinite(next.y) || Math.abs(next.y) > LARGE);

    if (prevProblematic || nextProblematic) {
      if (currentInterval.length > 1) intervals.push([...currentInterval]);
      currentInterval = [];
      continue;
    }

    currentInterval.push(p);
  }
  if (currentInterval.length > 1) intervals.push([...currentInterval]);

  // ==========================================
  // STEP 3: MONOTONICITY PER INTERVAL
  // ==========================================
  function classifySegment(points) {
    let strictUp = 0, strictDown = 0, flat = 0;
    for (let i = 1; i < points.length; i++) {
      const dy = points[i].y - points[i - 1].y;
      if (dy > 1e-4) strictUp++;
      else if (dy < -1e-4) strictDown++;
      else flat++;
    }
    const total = strictUp + strictDown + flat;
    if (total === 0 || flat === total) return 'constant';
    if (strictUp > 0 && strictDown === 0 && flat === 0) return 'strictly_increasing';
    if (strictDown > 0 && strictUp === 0 && flat === 0) return 'strictly_decreasing';
    if (strictUp > 0 && strictDown === 0) return 'non_decreasing';
    if (strictDown > 0 && strictUp === 0) return 'non_increasing';
    return 'mixed';
  }

  const increasingRegions = [];
  const decreasingRegions = [];
  const constantRegions = [];
  const turningPoints = [];

  for (const interval of intervals) {
    if (interval.length < 8) continue;

    let regionStart = interval[0].x;
    let prevSign = null;

    for (let i = 1; i < interval.length; i++) {
      const dy = interval[i].y - interval[i - 1].y;
      const dx = interval[i].x - interval[i - 1].x;
      const slope = dy / dx;
      const sign = slope > 1e-4 ? 1 : slope < -1e-4 ? -1 : 0;
      if (sign === 0) continue;

      if (prevSign === null) {
        prevSign = sign;
        regionStart = interval[i - 1].x;
      } else if (sign !== prevSign) {
        const range = [
          Math.round(regionStart * 100) / 100,
          Math.round(interval[i - 1].x * 100) / 100
        ];
        const subPts = interval.filter(p => p.x >= regionStart && p.x <= interval[i - 1].x);
        const cls = classifySegment(subPts);

        if (cls === 'strictly_increasing' || cls === 'non_decreasing')
          increasingRegions.push({ range, type: cls === 'strictly_increasing' ? 'Strictly Increasing' : 'Non-Decreasing' });
        else if (cls === 'strictly_decreasing' || cls === 'non_increasing')
          decreasingRegions.push({ range, type: cls === 'strictly_decreasing' ? 'Strictly Decreasing' : 'Non-Increasing' });

        turningPoints.push([
          Math.round(interval[i - 1].x * 100) / 100,
          Math.round(interval[i - 1].y * 100) / 100,
        ]);

        regionStart = interval[i - 1].x;
        prevSign = sign;
      }
    }

    const lastRange = [
      Math.round(regionStart * 100) / 100,
      Math.round(interval[interval.length - 1].x * 100) / 100
    ];
    const lastPts = interval.filter(p => p.x >= regionStart);
    const lastCls = classifySegment(lastPts);

    if (lastCls === 'strictly_increasing' || lastCls === 'non_decreasing')
      increasingRegions.push({ range: lastRange, type: lastCls === 'strictly_increasing' ? 'Strictly Increasing' : 'Non-Decreasing' });
    else if (lastCls === 'strictly_decreasing' || lastCls === 'non_increasing')
      decreasingRegions.push({ range: lastRange, type: lastCls === 'strictly_decreasing' ? 'Strictly Decreasing' : 'Non-Increasing' });
    else if (lastCls === 'constant')
      constantRegions.push({ range: lastRange, type: 'Constant' });
  }

  // ==========================================
  // STEP 4: FILTER FAKE RESULTS
  // ==========================================
  const MIN_WIDTH = 0.5;

  const cleanIncreasing = increasingRegions.filter(r =>
    (r.range[1] - r.range[0]) >= MIN_WIDTH
  );

  const cleanDecreasing = decreasingRegions.filter(r =>
    (r.range[1] - r.range[0]) >= MIN_WIDTH
  );

  const cleanTurningPoints = turningPoints.filter(([x, y]) =>
    Math.abs(y) < LARGE * 0.3
  );

  // ==========================================
  // SYMMETRY DETECTION
  // ==========================================
  const map = new Map();
  data.forEach(p => {
    if (p.y !== null && isFinite(p.y) && Math.abs(p.y) <= LARGE)
      map.set(Math.round(p.x * 100), p.y);
  });

  let evenMatches = 0, oddMatches = 0, symTotal = 0;
  const tolerance = scale * 0.02;

  for (const p of valid) {
    if (Math.abs(p.y) > LARGE) continue;
    const negKey = Math.round(-p.x * 100);
    if (map.has(negKey)) {
      const negY = map.get(negKey);
      symTotal++;
      if (Math.abs(p.y - negY) < tolerance) evenMatches++;
      if (Math.abs(p.y + negY) < tolerance) oddMatches++;
    }
  }

  let symmetry = 'neither';
  let symmetryConfidence = 0;
  if (symTotal > 0) {
    const evenRatio = evenMatches / symTotal;
    const oddRatio = oddMatches / symTotal;
    if (evenRatio > oddRatio && evenRatio > 0.8) { symmetry = 'even'; symmetryConfidence = evenRatio; }
    else if (oddRatio > evenRatio && oddRatio > 0.8) { symmetry = 'odd'; symmetryConfidence = oddRatio; }
  }

  // ==========================================
  // OVERFLOW vs TRUE UNDEFINED
  // ==========================================
  const overflowRegions = [];
  const trueUndefinedRegions = [];

  let inNull = false, nullStart = null;
  for (let i = 0; i < data.length; i++) {
    const isNull = data[i].y === null || !isFinite(data[i].y);
    if (isNull && !inNull) { inNull = true; nullStart = data[i].x; }
    if (!isNull && inNull) {
      inNull = false;
      const nullEnd = data[i - 1].x;
      const nearAsymptote = uniqueAsymptotes.some(
        a => a >= nullStart - 0.5 && a <= nullEnd + 0.5
      );
      if (!nearAsymptote) {
        const leftNeighbor = valid.find(p => Math.abs(p.x - nullStart) < 0.3);
        if (leftNeighbor && Math.abs(leftNeighbor.y) > LARGE)
          overflowRegions.push([Math.round(nullStart * 100) / 100, Math.round(nullEnd * 100) / 100]);
        else
          trueUndefinedRegions.push([Math.round(nullStart * 100) / 100, Math.round(nullEnd * 100) / 100]);
      }
    }
  }
  if (inNull) trueUndefinedRegions.push([Math.round(nullStart * 100) / 100, data[data.length - 1].x]);

  // Continuity classification
  let continuity = 'continuous';
if (uniqueAsymptotes.length > 0) continuity = 'vertical-asymptote';
else if (uniqueJumps.length > 0) continuity = 'jump-discontinuity';
else if (uniqueAsymptotes.length > 0 && uniqueJumps.length > 0) continuity = 'mixed-discontinuity';
  else if (uniqueRemovable.length > 0) continuity = 'removable-discontinuity';
  else if (trueUndefinedRegions.length > 0) continuity = 'partially-undefined';

  const isConstant = cleanIncreasing.length === 0 && cleanDecreasing.length === 0 && constantRegions.length > 0;

  return {
    continuity,
    asymptotes: uniqueAsymptotes,
    jumpDiscontinuities: uniqueJumps,
    removableDiscontinuities: uniqueRemovable,
    overflowRegions,
    trueUndefinedRegions,
    isConstant,
    domain: trueUndefinedRegions.length === 0 ? 'All real numbers (in this view)' : 'Partially undefined',
    range: { min: Math.round(yMin * 100) / 100, max: Math.round(yMax * 100) / 100 },
    symmetry,
    symmetryConfidence: Math.round(symmetryConfidence * 100),
    increasingRegions: cleanIncreasing,
    decreasingRegions: cleanDecreasing,
    constantRegions,
    turningPoints: cleanTurningPoints,
  };
}