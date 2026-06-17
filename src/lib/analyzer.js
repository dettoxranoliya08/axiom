export function analyzeFunction(data) {
  const valid = data.filter(p => p.y !== null && isFinite(p.y));
  if (valid.length === 0) {
    return { error: 'No valid data points in this range' };
  }

  const yValues = valid.map(p => p.y);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  // Undefined regions
  const undefinedRegions = [];
  let start = null;
  for (let i = 0; i < data.length; i++) {
    const isUndefined = data[i].y === null || !isFinite(data[i].y);
    if (isUndefined && start === null) start = data[i].x;
    if (!isUndefined && start !== null) {
      undefinedRegions.push([start, data[i - 1].x]);
      start = null;
    }
  }
  if (start !== null) undefinedRegions.push([start, data[data.length - 1].x]);

  // Symmetry detection
  const map = new Map();
  data.forEach(p => { if (p.y !== null) map.set(Math.round(p.x * 100), p.y); });

  let evenMatches = 0, oddMatches = 0, total = 0;
  const scale = Math.max(Math.abs(yMax), Math.abs(yMin), 1);
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
      symmetry = 'even';
      symmetryConfidence = evenRatio;
    } else if (oddRatio > evenRatio && oddRatio > 0.8) {
      symmetry = 'odd';
      symmetryConfidence = oddRatio;
    }
  }

  // Strict vs non-strict classification
  function classifySegment(points) {
    let strictUp = 0, strictDown = 0, flat = 0;
    for (let i = 1; i < points.length; i++) {
      const dy = points[i].y - points[i-1].y;
      if (dy > 1e-6) strictUp++;
      else if (dy < -1e-6) strictDown++;
      else flat++;
    }
    const total = strictUp + strictDown + flat;
    if (total === 0) return 'constant';
    if (flat === total) return 'constant';
    if (strictUp > 0 && strictDown === 0 && flat === 0) return 'strictly_increasing';
    if (strictDown > 0 && strictUp === 0 && flat === 0) return 'strictly_decreasing';
    if (strictUp > 0 && strictDown === 0) return 'non_decreasing';
    if (strictDown > 0 && strictUp === 0) return 'non_increasing';
    return 'mixed';
  }

  // Behavior regions
  const regions = [];
  const turningPoints = [];

  let regionStart = valid[0].x;
  let prevSign = null;

  for (let i = 1; i < valid.length; i++) {
    const dx = valid[i].x - valid[i-1].x;
    const dy = valid[i].y - valid[i-1].y;
    const slope = dy / dx;
    const sign = slope > 1e-6 ? 1 : slope < -1e-6 ? -1 : 0;
    if (sign === 0) continue;

    if (prevSign === null) {
      prevSign = sign;
      regionStart = valid[i-1].x;
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

  // Classify each region
  const increasingRegions = [];
  const decreasingRegions = [];
  const constantRegions = [];

  for (const region of regions) {
    const regionPoints = valid.filter(p => p.x >= region.start && p.x <= region.end);
    const classification = classifySegment(regionPoints);
    const range = [Math.round(region.start * 100) / 100, Math.round(region.end * 100) / 100];

    if (classification === 'strictly_increasing') increasingRegions.push({ range, type: 'Strictly Increasing' });
    else if (classification === 'non_decreasing') increasingRegions.push({ range, type: 'Non-Decreasing' });
    else if (classification === 'strictly_decreasing') decreasingRegions.push({ range, type: 'Strictly Decreasing' });
    else if (classification === 'non_increasing') decreasingRegions.push({ range, type: 'Non-Increasing' });
    else if (classification === 'constant') constantRegions.push({ range, type: 'Constant' });
  }

  // Overall behavior
  const allClassifications = [
    ...increasingRegions.map(r => r.type),
    ...decreasingRegions.map(r => r.type),
    ...constantRegions.map(r => r.type),
  ];
  const isConstant = allClassifications.every(c => c === 'Constant');
  const isDiscontinuous = undefinedRegions.length > 0 || turningPoints.length > 10;
  // Jump discontinuity detection
const jumpDiscontinuities = [];
for (let i = 1; i < valid.length; i++) {
  const dx = valid[i].x - valid[i-1].x;
  const dy = Math.abs(valid[i].y - valid[i-1].y);
  const scale = Math.max(Math.abs(yMax - yMin), 1);
  if (dx < 0.15 && dy > scale * 0.08) {
    jumpDiscontinuities.push(Math.round(valid[i-1].x * 10) / 10);
  }
}

// Overflow detection
const overflowClipped = data.some(p => p.y === null && valid.length > 0);

  return {
    isDiscontinuous,
    isConstant,
    domain: undefinedRegions.length === 0 ? 'All real numbers (in this view)' : 'Some values undefined (see below)',
    range: { min: Math.round(yMin * 100) / 100, max: Math.round(yMax * 100) / 100 },
    symmetry,
    symmetryConfidence: Math.round(symmetryConfidence * 100),
    increasingRegions,
    decreasingRegions,
    constantRegions,
    undefinedRegions: undefinedRegions.map(r => r.map(v => Math.round(v * 100) / 100)),
    turningPoints,
    jumpDiscontinuities: [...new Set(jumpDiscontinuities)],
    overflowClipped,
  };
}