export function analyzeFunction(data) {
  const valid = data.filter(p => p.y !== null && isFinite(p.y));
  if (valid.length === 0) {
    return { error: 'No valid data points in this range' };
  }

  const yValues = valid.map(p => p.y);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const scale = Math.max(Math.abs(yMax), Math.abs(yMin), 1);

  // ==========================================
  // DISCONTINUITY ANALYSIS
  // ==========================================

  const jumpDiscontinuities = [];
  const verticalAsymptotes = [];
  const overflowRegions = [];
  const trueUndefinedRegions = [];
  const removableDiscontinuities = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const dx = curr.x - prev.x;

    // Both valid - check for jump discontinuity
    if (prev.y !== null && isFinite(prev.y) && curr.y !== null && isFinite(curr.y)) {
      const dy = Math.abs(curr.y - prev.y);
      if (dx < 0.15 && dy > scale * 0.1) {
        jumpDiscontinuities.push(Math.round(prev.x * 10) / 10);
      }
    }

    // Transition: valid -> null
    if (prev.y !== null && isFinite(prev.y) && (curr.y === null || !isFinite(curr.y))) {
      if (Math.abs(prev.y) > scale * 0.85) {
        verticalAsymptotes.push(Math.round(curr.x * 10) / 10);
      }
    }

    // Transition: null -> valid
    if ((prev.y === null || !isFinite(prev.y)) && curr.y !== null && isFinite(curr.y)) {
      if (Math.abs(curr.y) > scale * 0.85) {
        verticalAsymptotes.push(Math.round(prev.x * 10) / 10);
      }
    }
  }

  // Separate overflow vs true undefined
  let inNull = false;
  let nullStart = null;
  for (let i = 0; i < data.length; i++) {
    const isNull = data[i].y === null || !isFinite(data[i].y);
    if (isNull && !inNull) {
      inNull = true;
      nullStart = data[i].x;
    }
    if (!isNull && inNull) {
      inNull = false;
      const nullEnd = data[i - 1].x;
      const nearAsymptote = verticalAsymptotes.some(
        a => a >= nullStart - 0.5 && a <= nullEnd + 0.5
      );
      if (nearAsymptote) {
        // skip - already caught as asymptote
      } else {
        // Check neighbors: if they were large -> overflow, else true undefined
        const leftNeighbor = data.find(p => Math.abs(p.x - nullStart) < 0.2 && p.y !== null);
        const rightNeighbor = [...data].reverse().find(p => Math.abs(p.x - nullEnd) < 0.2 && p.y !== null);
        const leftLarge = leftNeighbor && Math.abs(leftNeighbor.y) > scale * 0.8;
        const rightLarge = rightNeighbor && Math.abs(rightNeighbor.y) > scale * 0.8;
        if (leftLarge || rightLarge) {
          overflowRegions.push([Math.round(nullStart * 100) / 100, Math.round(nullEnd * 100) / 100]);
        } else {
          trueUndefinedRegions.push([Math.round(nullStart * 100) / 100, Math.round(nullEnd * 100) / 100]);
        }
      }
    }
  }
  if (inNull) trueUndefinedRegions.push([Math.round(nullStart * 100) / 100, data[data.length - 1].x]);

  // Removable discontinuity: isolated null with similar neighbors
  for (let i = 1; i < data.length - 1; i++) {
    if ((data[i].y === null || !isFinite(data[i].y)) &&
        data[i-1].y !== null && isFinite(data[i-1].y) &&
        data[i+1].y !== null && isFinite(data[i+1].y)) {
      if (Math.abs(data[i-1].y - data[i+1].y) < scale * 0.05) {
        removableDiscontinuities.push(Math.round(data[i].x * 10) / 10);
      }
    }
  }

  // Determine continuity classification
  const uniqueAsymptotes = [...new Set(verticalAsymptotes)];
  const uniqueJumps = [...new Set(jumpDiscontinuities)];

  let continuity = 'continuous';
  if (uniqueAsymptotes.length > 0 && uniqueJumps.length > 0) {
    continuity = 'mixed-discontinuity';
  } else if (uniqueAsymptotes.length > 0) {
    continuity = 'vertical-asymptote';
  } else if (uniqueJumps.length > 0) {
    continuity = 'jump-discontinuity';
  } else if (removableDiscontinuities.length > 0) {
    continuity = 'removable-discontinuity';
  } else if (trueUndefinedRegions.length > 0) {
    continuity = 'partially-undefined';
  }

  // ==========================================
  // SYMMETRY DETECTION
  // ==========================================
  const map = new Map();
  data.forEach(p => { if (p.y !== null) map.set(Math.round(p.x * 100), p.y); });

  let evenMatches = 0, oddMatches = 0, total = 0;
  const tolerance = scale * 0.02;

  for (const p of valid) {
    const negKey = Math.round(-p.x * 100);
    if (map.has(negKey)) {
      const negY = map.get(negKey);
      total++;
      if (Math.abs(p.y - negY) < tolerance) evenMatches++;
      if (Math.abs(p.y + negY) < tolerance) oddMatches++;
    }
  }

  let symmetry = 'neither';
  let symmetryConfidence = 0;
  if (total > 0) {
    const evenRatio = evenMatches / total;
    const oddRatio = oddMatches / total;
    if (evenRatio > oddRatio && evenRatio > 0.8) {
      symmetry = 'even'; symmetryConfidence = evenRatio;
    } else if (oddRatio > evenRatio && oddRatio > 0.8) {
      symmetry = 'odd'; symmetryConfidence = oddRatio;
    }
  }

  // ==========================================
  // BEHAVIOR CLASSIFICATION
  // ==========================================
  function classifySegment(points) {
    let strictUp = 0, strictDown = 0, flat = 0;
    for (let i = 1; i < points.length; i++) {
      const dy = points[i].y - points[i-1].y;
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
    if (flat > 0 && strictUp === 0 && strictDown === 0) return 'piecewise_constant';
    return 'mixed';
  }

  const regions = [];
  const turningPoints = [];
  let regionStart = valid[0].x;
  let prevSign = null;

  for (let i = 1; i < valid.length; i++) {
    const dy = valid[i].y - valid[i-1].y;
    const dx = valid[i].x - valid[i-1].x;
    const slope = dy / dx;
    const sign = slope > 1e-4 ? 1 : slope < -1e-4 ? -1 : 0;
    if (sign === 0) continue;

    if (prevSign === null) {
      prevSign = sign; regionStart = valid[i-1].x;
    } else if (sign !== prevSign) {
      regions.push({ start: regionStart, end: valid[i-1].x, sign: prevSign });
      turningPoints.push([
        Math.round(valid[i-1].x * 100) / 100,
        Math.round(valid[i-1].y * 100) / 100,
      ]);
      regionStart = valid[i-1].x;
      prevSign = sign;
    }
  }
  if (prevSign !== null) regions.push({ start: regionStart, end: valid[valid.length-1].x, sign: prevSign });

  const increasingRegions = [];
  const decreasingRegions = [];
  const constantRegions = [];

  for (const region of regions) {
    const pts = valid.filter(p => p.x >= region.start && p.x <= region.end);
    const cls = classifySegment(pts);
    const range = [Math.round(region.start * 100) / 100, Math.round(region.end * 100) / 100];

    if (cls === 'strictly_increasing') increasingRegions.push({ range, type: 'Strictly Increasing' });
    else if (cls === 'non_decreasing') increasingRegions.push({ range, type: 'Non-Decreasing' });
    else if (cls === 'strictly_decreasing') decreasingRegions.push({ range, type: 'Strictly Decreasing' });
    else if (cls === 'non_increasing') decreasingRegions.push({ range, type: 'Non-Increasing' });
    else if (cls === 'constant' || cls === 'piecewise_constant') constantRegions.push({ range, type: 'Constant' });
  }

  const isConstant = [...increasingRegions, ...decreasingRegions].length === 0 && constantRegions.length > 0;

  return {
    continuity,
    asymptotes: uniqueAsymptotes,
    jumpDiscontinuities: uniqueJumps,
    removableDiscontinuities,
    overflowRegions,
    trueUndefinedRegions,
    isConstant,
    domain: trueUndefinedRegions.length === 0 ? 'All real numbers (in this view)' : 'Partially undefined',
    range: { min: Math.round(yMin * 100) / 100, max: Math.round(yMax * 100) / 100 },
    symmetry,
    symmetryConfidence: Math.round(symmetryConfidence * 100),
    increasingRegions,
    decreasingRegions,
    constantRegions,
    turningPoints,
  };
}