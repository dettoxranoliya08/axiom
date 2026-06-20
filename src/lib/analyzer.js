function getEmptyResult() {
  return {
    domain: 'Enter a function',
    domainIntervals: [],
    range: { min: 0, max: 0, note: 'visible range' },
    symmetry: 'neither',
    symmetryConfidence: 0,
    continuity: 'continuous',
    asymptotes: [],
    jumpDiscontinuities: [],
    removableDiscontinuities: [],
    horizontalAsymptotes: [],
    increasingRegions: [],
    decreasingRegions: [],
    constantRegions: [],
    turningPoints: [],
    isConstant: false,
    overflowRegions: [],
  };
}

function snapBoundary(val) {
  if (Math.abs(val) < 0.25) return 0;
  const rounded1 = Math.round(val);
  if (Math.abs(val - rounded1) < 0.25) return rounded1;
  const rounded5 = Math.round(val * 2) / 2;
  if (Math.abs(val - rounded5) < 0.15) return rounded5;
  return Math.round(val * 10) / 10;
}

function snapToTrigValue(val) {
  const candidates = [];
  for (let k = -4; k <= 4; k++) {
    candidates.push(Math.PI / 2 + k * Math.PI);
    candidates.push(k * Math.PI);
  }
  for (const c of candidates) {
    if (Math.abs(val - c) < 0.25) {
      return Math.round(c * 100) / 100;
    }
  }
  return snapBoundary(val);
}

export function analyzeFunction(data) {
  if (!data || data.length === 0) return getEmptyResult();

  const classified = data.map(p => ({
    x: p.x,
    y: p.y,
    status: p.clipped ? 'clipped'
          : (p.undefined || p.y === null || (typeof p.y === 'object') || isNaN(p.y) || !isFinite(p.y)) ? 'undefined'
          : 'valid'
  }));

  const validPoints = classified.filter(p => p.status === 'valid');
  if (validPoints.length === 0) return getEmptyResult();

  const yValues = validPoints.map(p => p.y);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const scale = Math.max(Math.abs(yMax), Math.abs(yMin), 1);
  const LARGE = scale * 0.15;

  // STEP 2: DOMAIN ENGINE
  const domainIntervals = [];
  let inValid = false;
  let intervalStart = null;

  for (let i = 0; i < classified.length; i++) {
    const p = classified[i];
    const isValid = p.status === 'valid';

    if (isValid && !inValid) {
      inValid = true;
      intervalStart = p.x;
    }
    if (!isValid && inValid) {
      inValid = false;
      domainIntervals.push({
        from: snapBoundary(Math.round(intervalStart * 10) / 10),
        to: snapBoundary(Math.round(classified[i - 1].x * 10) / 10),
        fromOpen: false,
        toOpen: false,
      });
    }
  }
  if (inValid) {
    domainIntervals.push({
      from: snapBoundary(Math.round(intervalStart * 10) / 10),
      to: snapBoundary(Math.round(classified[classified.length - 1].x * 10) / 10),
      fromOpen: false,
      toOpen: false,
    });
  }

  // STEP 3: ASYMPTOTE ENGINE
  const verticalAsymptotes = [];

  for (let i = 1; i < classified.length; i++) {
    const prev = classified[i - 1];
    const curr = classified[i];

    const prevLarge = prev.status === 'valid' && Math.abs(prev.y) > LARGE;
    const currLarge = curr.status === 'valid' && Math.abs(curr.y) > LARGE;
    const prevUndef = prev.status === 'undefined';
    const currUndef = curr.status === 'undefined';

    if (prevLarge && currLarge) {
      const oppSigns = (prev.y > 0 && curr.y < 0) || (prev.y < 0 && curr.y > 0);
      if (oppSigns) {
        verticalAsymptotes.push(snapToTrigValue(Math.round(((prev.x + curr.x) / 2) * 10) / 10));
      }
    }
    if (prevLarge && currUndef) verticalAsymptotes.push(snapToTrigValue(Math.round(curr.x * 10) / 10));
    if (prevUndef && currLarge) verticalAsymptotes.push(snapToTrigValue(Math.round(prev.x * 10) / 10));
  }

  const uniqueAsymptotes = [...new Set(verticalAsymptotes)];

  domainIntervals.forEach(interval => {
    if (uniqueAsymptotes.some(a => Math.abs(a - interval.from) < 0.3)) interval.fromOpen = true;
    if (uniqueAsymptotes.some(a => Math.abs(a - interval.to) < 0.3)) interval.toOpen = true;
  });

  // STEP 4: DOMAIN DISPLAY STRING
  function formatDomainString(intervals) {
    if (intervals.length === 0) return 'Undefined everywhere';
    if (intervals.length >= 4) return 'ℝ \\ {vertical asymptotes} (in this view)';
    if (intervals.length === 1) {
      const iv = intervals[0];
      const from = iv.from <= -9.9 ? '-∞' : iv.from;
      const to = iv.to >= 9.9 ? '+∞' : iv.to;
      if (from === '-∞' && to === '+∞') return 'All real numbers (in this view)';
      if (from === '-∞') return `x ${iv.toOpen ? '<' : '≤'} ${to} (in this view)`;
      if (to === '+∞') return `x ${iv.fromOpen ? '>' : '≥'} ${from} (in this view)`;
      return `[${from}, ${to}] (in this view)`;
    }
    return intervals.map(iv => {
      const from = iv.from <= -9.9 ? '-∞' : iv.from;
      const to = iv.to >= 9.9 ? '+∞' : iv.to;
      const l = iv.fromOpen ? '(' : '[';
      const r = iv.toOpen ? ')' : ']';
      return `${l}${from}, ${to}${r}`;
    }).join(' ∪ ');
  }

  // STEP 5: CONTINUITY ENGINE
  const jumpDiscontinuities = [];
  const removableDiscontinuities = [];

  for (let i = 1; i < classified.length; i++) {
    const prev = classified[i - 1];
    const curr = classified[i];
    const dx = Math.abs(curr.x - prev.x);

    const prevValid = prev.status === 'valid' && Math.abs(prev.y) <= LARGE;
    const currValid = curr.status === 'valid' && Math.abs(curr.y) <= LARGE;

    if (prevValid && currValid) {
      const dy = Math.abs(curr.y - prev.y);
      const nearAsymptote = uniqueAsymptotes.some(a =>
        Math.abs(a - prev.x) < 0.3 || Math.abs(a - curr.x) < 0.3
      );
      const atDomainBoundary = domainIntervals.some(iv =>
        Math.abs(iv.from - prev.x) < 0.3 || Math.abs(iv.from - curr.x) < 0.3 ||
        Math.abs(iv.to - prev.x) < 0.3 || Math.abs(iv.to - curr.x) < 0.3
      );
      if (dx < 0.15 && dy > scale * 0.08 && !nearAsymptote && !atDomainBoundary) {
        jumpDiscontinuities.push(snapBoundary(Math.round(prev.x * 10) / 10));
      }
    }

    if (i < classified.length - 1) {
      const next = classified[i + 1];
      const nextValid = next.status === 'valid' && Math.abs(next.y) <= LARGE;
      if (prevValid && curr.status === 'undefined' && nextValid) {
        if (Math.abs(prev.y - next.y) < scale * 0.05) {
          removableDiscontinuities.push(snapBoundary(Math.round(curr.x * 10) / 10));
        }
      }
    }
  }

  const uniqueJumps = [...new Set(jumpDiscontinuities)];
  const uniqueRemovable = [...new Set(removableDiscontinuities)];

  let continuity = 'continuous';
  if (uniqueAsymptotes.length > 0) continuity = 'vertical-asymptote';
  else if (uniqueJumps.length > 0) continuity = 'jump-discontinuity';
  else if (uniqueRemovable.length > 0) continuity = 'removable-discontinuity';
  else if (domainIntervals.length > 1) continuity = 'partially-undefined';

  // STEP 6: INTERVAL BUILDER — FIX #1
  // Pehle: prevBad || nextBad se valid boundary points bhi drop hote the
  // Ab: sirf asymptote-adjacent points ko remove karo, normal boundaries allow karo
  const safeIntervals = [];
  let currentInterval = [];

  for (let i = 0; i < classified.length; i++) {
    const p = classified[i];

    // Skip karo agar point valid nahi ya bahut large hai
    if (p.status !== 'valid' || Math.abs(p.y) > LARGE) {
      if (currentInterval.length > 1) safeIntervals.push([...currentInterval]);
      currentInterval = [];
      continue;
    }

    // Skip karo agar asymptote ke bilkul paas hai
    const nearAsymptote = uniqueAsymptotes.some(a => Math.abs(a - p.x) < 0.2);
    if (nearAsymptote) {
      if (currentInterval.length > 1) safeIntervals.push([...currentInterval]);
      currentInterval = [];
      continue;
    }

    currentInterval.push(p);
  }
  if (currentInterval.length > 1) safeIntervals.push([...currentInterval]);

  // STEP 7: MONOTONICITY ENGINE
  function classifySegment(points) {
    if (!points || points.length < 2) return 'unknown';
    let up = 0, down = 0, flat = 0;
    for (let i = 1; i < points.length; i++) {
      const dy = points[i].y - points[i - 1].y;
      if (dy > 1e-4) up++;
      else if (dy < -1e-4) down++;
      else flat++;
    }
    const total = up + down + flat;
    if (total === 0 || flat === total) return 'constant';
    if (up > 0 && down === 0 && flat === 0) return 'strictly_increasing';
    if (down > 0 && up === 0 && flat === 0) return 'strictly_decreasing';
    if (up > 0 && down === 0) return 'non_decreasing';
    if (down > 0 && up === 0) return 'non_increasing';
    return 'mixed';
  }

  const increasingRegions = [];
  const decreasingRegions = [];
  const constantRegions = [];
  const turningPoints = [];

  for (const interval of safeIntervals) {
    // FIX #2: 8 se 3 kar diya — chhote intervals bhi process honge
    if (interval.length < 3) continue;

    let regionStart = interval[0].x;
    let prevSign = null;

    for (let i = 1; i < interval.length; i++) {
      const dx = interval[i].x - interval[i - 1].x;
      if (dx === 0) continue;
      const slope = (interval[i].y - interval[i - 1].y) / dx;
      const sign = slope > 1e-4 ? 1 : slope < -1e-4 ? -1 : 0;
      if (sign === 0) continue;

      if (prevSign === null) {
        prevSign = sign;
        regionStart = interval[i - 1].x;
      } else if (sign !== prevSign) {
        const range = [
          snapBoundary(Math.round(regionStart * 100) / 100),
          snapBoundary(Math.round(interval[i - 1].x * 100) / 100)
        ];
        const sub = interval.filter(p => p.x >= regionStart && p.x <= interval[i - 1].x);
        const cls = classifySegment(sub);
        if (cls === 'strictly_increasing' || cls === 'non_decreasing')
          increasingRegions.push({ range, type: cls === 'strictly_increasing' ? 'Strictly Increasing' : 'Non-Decreasing' });
        else if (cls === 'strictly_decreasing' || cls === 'non_increasing')
          decreasingRegions.push({ range, type: cls === 'strictly_decreasing' ? 'Strictly Decreasing' : 'Non-Increasing' });

        turningPoints.push([
          snapBoundary(Math.round(interval[i - 1].x * 100) / 100),
          Math.round(interval[i - 1].y * 100) / 100
        ]);
        regionStart = interval[i - 1].x;
        prevSign = sign;
      }
    }

    // Last region
    const lastRange = [
      snapBoundary(Math.round(regionStart * 100) / 100),
      snapBoundary(Math.round(interval[interval.length - 1].x * 100) / 100)
    ];
    const lastSub = interval.filter(p => p.x >= regionStart);
    const lastCls = classifySegment(lastSub);

    if (lastCls === 'strictly_increasing' || lastCls === 'non_decreasing')
      increasingRegions.push({ range: lastRange, type: lastCls === 'strictly_increasing' ? 'Strictly Increasing' : 'Non-Decreasing' });
    else if (lastCls === 'strictly_decreasing' || lastCls === 'non_increasing')
      decreasingRegions.push({ range: lastRange, type: lastCls === 'strictly_decreasing' ? 'Strictly Decreasing' : 'Non-Increasing' });
    else if (lastCls === 'constant')
      constantRegions.push({ range: lastRange, type: 'Constant' });
  }

  // FIX #3: MIN_WIDTH 0.5 → 0.15 — valid chhote regions ab bhi dikhenge
  const MIN_WIDTH = 0.15;
  const cleanIncreasing = increasingRegions
    .filter(r => (r.range[1] - r.range[0]) >= MIN_WIDTH)
    .map(r => ({ ...r, range: [snapBoundary(r.range[0]), snapBoundary(r.range[1])] }));
  const cleanDecreasing = decreasingRegions
    .filter(r => (r.range[1] - r.range[0]) >= MIN_WIDTH)
    .map(r => ({ ...r, range: [snapBoundary(r.range[0]), snapBoundary(r.range[1])] }));
  const cleanTurning = turningPoints.filter(([x, y]) => {
    if (Math.abs(y) > LARGE * 0.3) return false;
    if (uniqueAsymptotes.some(a => Math.abs(a - x) < 0.3)) return false;
    return true;
  });

  // STEP 8: SYMMETRY ENGINE
  const symMap = new Map();
  classified.forEach(p => {
    if (p.status === 'valid') symMap.set(Math.round(p.x * 100), p.y);
  });

  let evenM = 0, oddM = 0, symTotal = 0;
  const symTol = Math.max(Math.abs(yMax), Math.abs(yMin), 1) * 0.05;

  for (const p of classified) {
    if (p.status !== 'valid') continue;
    if (Math.abs(p.x) < 0.05) continue;
    const negKey = Math.round(-p.x * 100);
    if (symMap.has(negKey)) {
      const negY = symMap.get(negKey);
      symTotal++;
      if (Math.abs(p.y - negY) < symTol) evenM++;
      if (Math.abs(p.y + negY) < symTol) oddM++;
    }
  }

  let symmetry = 'neither';
  let symmetryConfidence = 0;
  if (symTotal > 0) {
    const eR = evenM / symTotal;
    const oR = oddM / symTotal;
    if (eR > oR && eR > 0.8) { symmetry = 'even'; symmetryConfidence = eR; }
    else if (oR > eR && oR > 0.8) { symmetry = 'odd'; symmetryConfidence = oR; }
  }

  // STEP 9: HORIZONTAL ASYMPTOTE
  const horizontalAsymptotes = [];
  const leftPts = validPoints.filter(p => p.x < -8);
  const rightPts = validPoints.filter(p => p.x > 8);
  if (leftPts.length > 3 && rightPts.length > 3) {
    const leftAvg = leftPts.slice(-3).reduce((s, p) => s + p.y, 0) / 3;
    const rightAvg = rightPts.slice(-3).reduce((s, p) => s + p.y, 0) / 3;
    if (Math.abs(leftAvg - rightAvg) < 0.1 && Math.abs(leftAvg) < scale * 0.1) {
      horizontalAsymptotes.push(Math.round(leftAvg * 100) / 100);
    }
  }

  // STEP 10: OVERFLOW
  const overflowRegions = [];
  let inOver = false, overStart = null;
  for (let i = 0; i < classified.length; i++) {
    const isOver = classified[i].status === 'clipped';
    if (isOver && !inOver) { inOver = true; overStart = classified[i].x; }
    if (!isOver && inOver) {
      inOver = false;
      overflowRegions.push([Math.round(overStart * 100) / 100, Math.round(classified[i - 1].x * 100) / 100]);
    }
  }
  if (inOver) overflowRegions.push([Math.round(overStart * 100) / 100, classified[classified.length - 1].x]);

  // FIX #4: Agar koi region nahi mila toh fallback — poore data pe classifySegment chalao
  let finalIncreasing = cleanIncreasing;
  let finalDecreasing = cleanDecreasing;

  if (cleanIncreasing.length === 0 && cleanDecreasing.length === 0 && constantRegions.length === 0) {
    // Fallback: saare valid, non-large points pe ek baar classify karo
    const fallbackPoints = classified.filter(p =>
      p.status === 'valid' &&
      Math.abs(p.y) <= LARGE &&
      !uniqueAsymptotes.some(a => Math.abs(a - p.x) < 0.3)
    );
    if (fallbackPoints.length >= 3) {
      const cls = classifySegment(fallbackPoints);
      const range = [
        snapBoundary(fallbackPoints[0].x),
        snapBoundary(fallbackPoints[fallbackPoints.length - 1].x)
      ];
      if (cls === 'strictly_increasing' || cls === 'non_decreasing')
        finalIncreasing = [{ range, type: cls === 'strictly_increasing' ? 'Strictly Increasing' : 'Non-Decreasing' }];
      else if (cls === 'strictly_decreasing' || cls === 'non_increasing')
        finalDecreasing = [{ range, type: cls === 'strictly_decreasing' ? 'Strictly Decreasing' : 'Non-Increasing' }];
    }
  }

  return {
    domain: formatDomainString(domainIntervals),
    domainIntervals,
    range: { min: Math.round(yMin * 100) / 100, max: Math.round(yMax * 100) / 100, note: 'visible range' },
    symmetry,
    symmetryConfidence: Math.round(symmetryConfidence * 100),
    continuity,
    asymptotes: uniqueAsymptotes,
    jumpDiscontinuities: uniqueJumps,
    removableDiscontinuities: uniqueRemovable,
    horizontalAsymptotes,
    increasingRegions: finalIncreasing,
    decreasingRegions: finalDecreasing,
    constantRegions,
    turningPoints: cleanTurning,
    isConstant: finalIncreasing.length === 0 && finalDecreasing.length === 0 && constantRegions.length > 0,
    overflowRegions,
  };
}