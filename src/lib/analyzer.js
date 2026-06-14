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

  // Increasing/decreasing regions + turning points
  const increasingRegions = [];
  const decreasingRegions = [];
  const turningPoints = [];

  let regionStart = valid[0].x;
  let prevSign = null;

  for (let i = 1; i < valid.length; i++) {
    const dx = valid[i].x - valid[i - 1].x;
    const dy = valid[i].y - valid[i - 1].y;
    const slope = dy / dx;
    const sign = slope > 1e-6 ? 1 : slope < -1e-6 ? -1 : 0;
    if (sign === 0) continue;

    if (prevSign === null) {
      prevSign = sign;
      regionStart = valid[i - 1].x;
    } else if (sign !== prevSign) {
      if (prevSign === 1) increasingRegions.push([regionStart, valid[i - 1].x]);
      else decreasingRegions.push([regionStart, valid[i - 1].x]);

      turningPoints.push([
        Math.round(valid[i - 1].x * 100) / 100,
        Math.round(valid[i - 1].y * 100) / 100,
      ]);

      regionStart = valid[i - 1].x;
      prevSign = sign;
    }
  }
  if (prevSign === 1) increasingRegions.push([regionStart, valid[valid.length - 1].x]);
  else if (prevSign === -1) decreasingRegions.push([regionStart, valid[valid.length - 1].x]);

  return {
    domain: undefinedRegions.length === 0 ? 'All real numbers (in this view)' : 'Some values undefined (see below)',
    range: { min: Math.round(yMin * 100) / 100, max: Math.round(yMax * 100) / 100 },
    symmetry,
    symmetryConfidence: Math.round(symmetryConfidence * 100),
    increasingRegions: increasingRegions.map(r => r.map(v => Math.round(v * 100) / 100)),
    decreasingRegions: decreasingRegions.map(r => r.map(v => Math.round(v * 100) / 100)),
    undefinedRegions: undefinedRegions.map(r => r.map(v => Math.round(v * 100) / 100)),
    turningPoints,
  };
}