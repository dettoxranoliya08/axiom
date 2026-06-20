export const SOURCE_TYPES = {
  SYMBOLIC_PROVEN: 'symbolic_proven',
  NUMERICAL_ESTIMATE: 'numerical_estimate',
  VISUAL_OBSERVATION: 'visual_observation',
  UNKNOWN: 'unknown',
};

export const CONFIDENCE_LEVELS = {
  CERTAIN: 'certain',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
};

export function createConfidence({ level, score, reason }) {
  return {
    level,
    score,
    reason,
  };
}

export function createProvenanceSource({ type, engine, method, version }) {
  return {
    type,
    engine,
    method,
    version,
  };
}

export function createEvidence({ type, summary, data = {}, scope = null }) {
  return {
    type,
    summary,
    data,
    ...(scope ? { scope } : {}),
  };
}

export function createScope({
  variable = 'x',
  viewport = { xMin: -10, xMax: 10 },
  global = false,
} = {}) {
  return {
    variable,
    viewport,
    global,
  };
}

export function createClaim({
  id,
  kind,
  value,
  confidence,
  source,
  evidence = [],
  scope,
  status = 'resolved',
  warnings = [],
}) {
  return {
    id,
    kind,
    value,
    confidence,
    source,
    evidence,
    scope,
    status,
    warnings,
  };
}

export function createInsightObject({
  expression,
  claims,
  graph,
  legacy,
  warnings = [],
  meta,
}) {
  return {
    expression,
    claims,
    graph,
    legacy,
    warnings,
    meta,
  };
}
