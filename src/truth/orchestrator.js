import { createInsightObject } from './models.js';
import { runLegacyVisualAnalyzer } from './legacyVisualAnalyzer.js';
import { analyzeSymbolicDomain } from './symbolic/symbolicDomain.js';

const ENGINE_VERSION = 'truth-engine-m2';

function createExpressionRecord(expression) {
  return {
    originalInput: expression,
    normalizedInput: expression?.trim() || '',
    parseStatus: expression?.trim() ? 'unverified' : 'empty',
    diagnostics: [],
  };
}

function createGraphRecord(samples, viewport) {
  return {
    viewport,
    samples,
    source: {
      type: 'visual_observation',
      engine: 'appSampler',
      method: 'fixed_step_viewport_sampling',
      version: '1.0',
    },
  };
}

export function analyzeWithTruthEngine({
  expression,
  samples,
  viewport = { xMin: -10, xMax: 10 },
}) {
  const startedAt = performance.now();
  const legacyVisual = runLegacyVisualAnalyzer(samples, { viewport });
  const symbolicDomain = analyzeSymbolicDomain(expression);
  const claims = {
    ...legacyVisual.claims,
    visualDomain: legacyVisual.claims.domain,
    domain: symbolicDomain,
  };
  const warnings = [
    {
      type: 'legacy_visual_observations',
      message: 'Legacy graph-sampled outputs remain visual observations and are not mathematical proof.',
    },
  ];

  if (symbolicDomain.status === 'unknown') {
    warnings.push(...symbolicDomain.warnings);
  }

  return createInsightObject({
    expression: createExpressionRecord(expression),
    claims,
    graph: createGraphRecord(samples, viewport),
    legacy: legacyVisual.legacy,
    warnings,
    meta: {
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      analysisCoverage: {
        symbolic: symbolicDomain.status === 'resolved',
        numerical: false,
        visual: true,
      },
    },
  });
}
