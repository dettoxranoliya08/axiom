import { analyzeFunction } from '../lib/analyzer.js';
import {
  CONFIDENCE_LEVELS,
  SOURCE_TYPES,
  createClaim,
  createConfidence,
  createEvidence,
  createProvenanceSource,
  createScope,
} from './models.js';

const LEGACY_VISUAL_SOURCE = createProvenanceSource({
  type: SOURCE_TYPES.VISUAL_OBSERVATION,
  engine: 'legacyVisualAnalyzer',
  method: 'fixed_viewport_sampling_adapter',
  version: '1.0',
});

function getSampleStats(samples) {
  const total = samples.length;
  const valid = samples.filter((point) => point.y !== null && !point.undefined && !point.clipped).length;
  const undefinedCount = samples.filter((point) => point.undefined).length;
  const clipped = samples.filter((point) => point.clipped).length;

  return {
    total,
    valid,
    undefined: undefinedCount,
    clipped,
  };
}

function createVisualConfidence(reason, score = 0.45) {
  return createConfidence({
    level: score >= 0.6 ? CONFIDENCE_LEVELS.MEDIUM : CONFIDENCE_LEVELS.LOW,
    score,
    reason,
  });
}

function createVisualEvidence({ field, summary, samples, legacyValue, scope }) {
  return [
    createEvidence({
      type: 'sample_points',
      summary,
      data: {
        field,
        sampleStats: getSampleStats(samples),
        legacyValue,
      },
      scope,
    }),
  ];
}

function createLegacyClaim({ field, kind, value, samples, scope, confidence, summary }) {
  return createClaim({
    id: `legacy.${field}`,
    kind,
    value,
    confidence,
    source: LEGACY_VISUAL_SOURCE,
    evidence: createVisualEvidence({
      field,
      summary,
      samples,
      legacyValue: value,
      scope,
    }),
    scope,
    status: 'resolved',
  });
}

export function runLegacyVisualAnalyzer(samples, { viewport = { xMin: -10, xMax: 10 } } = {}) {
  const legacy = analyzeFunction(samples);
  const scope = createScope({ viewport, global: false });
  const observedOnly = 'Observed from fixed-step graph samples; this is not a mathematical proof.';
  const visualEstimate = 'Estimated from fixed-step graph samples; this is not a mathematical proof.';

  const claims = {
    domain: createLegacyClaim({
      field: 'domain',
      kind: 'domain',
      value: {
        displayString: legacy.domain,
        intervals: legacy.domainIntervals,
      },
      samples,
      scope,
      confidence: createVisualConfidence(observedOnly, 0.45),
      summary: 'Legacy analyzer inferred visible-domain text from valid sampled points.',
    }),
    domainIntervals: createLegacyClaim({
      field: 'domainIntervals',
      kind: 'domain_intervals',
      value: legacy.domainIntervals,
      samples,
      scope,
      confidence: createVisualConfidence(observedOnly, 0.45),
      summary: 'Legacy analyzer grouped consecutive valid sampled points into intervals.',
    }),
    range: createLegacyClaim({
      field: 'range',
      kind: 'range',
      value: legacy.range,
      samples,
      scope,
      confidence: createVisualConfidence('Visible range computed from sampled y-values only.', 0.5),
      summary: 'Legacy analyzer computed minimum and maximum y-values among visible valid samples.',
    }),
    symmetry: createLegacyClaim({
      field: 'symmetry',
      kind: 'symmetry',
      value: {
        type: legacy.symmetry,
        legacyConfidencePercent: legacy.symmetryConfidence,
      },
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, Math.min(legacy.symmetryConfidence / 100, 0.6)),
      summary: 'Legacy analyzer compared sampled f(x) and f(-x) pairs.',
    }),
    symmetryConfidence: createLegacyClaim({
      field: 'symmetryConfidence',
      kind: 'symmetry_confidence',
      value: legacy.symmetryConfidence,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, Math.min(legacy.symmetryConfidence / 100, 0.6)),
      summary: 'Legacy analyzer reported a sampling-based symmetry confidence percentage.',
    }),
    continuity: createLegacyClaim({
      field: 'continuity',
      kind: 'continuity',
      value: legacy.continuity,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.4),
      summary: 'Legacy analyzer inferred continuity category from sampled gaps and jumps.',
    }),
    asymptotes: createLegacyClaim({
      field: 'asymptotes',
      kind: 'vertical_asymptotes',
      value: legacy.asymptotes,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.35),
      summary: 'Legacy analyzer inferred vertical asymptote candidates from sampled undefined or large behavior.',
    }),
    jumpDiscontinuities: createLegacyClaim({
      field: 'jumpDiscontinuities',
      kind: 'jump_discontinuities',
      value: legacy.jumpDiscontinuities,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.35),
      summary: 'Legacy analyzer inferred jump candidates from large changes between adjacent samples.',
    }),
    removableDiscontinuities: createLegacyClaim({
      field: 'removableDiscontinuities',
      kind: 'removable_discontinuities',
      value: legacy.removableDiscontinuities,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.35),
      summary: 'Legacy analyzer inferred removable candidates from isolated undefined samples.',
    }),
    horizontalAsymptotes: createLegacyClaim({
      field: 'horizontalAsymptotes',
      kind: 'horizontal_asymptotes',
      value: legacy.horizontalAsymptotes,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.3),
      summary: 'Legacy analyzer inferred horizontal asymptote candidates from viewport-edge samples.',
    }),
    increasingRegions: createLegacyClaim({
      field: 'increasingRegions',
      kind: 'increasing_regions',
      value: legacy.increasingRegions,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.45),
      summary: 'Legacy analyzer inferred increasing regions from finite differences between samples.',
    }),
    decreasingRegions: createLegacyClaim({
      field: 'decreasingRegions',
      kind: 'decreasing_regions',
      value: legacy.decreasingRegions,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.45),
      summary: 'Legacy analyzer inferred decreasing regions from finite differences between samples.',
    }),
    constantRegions: createLegacyClaim({
      field: 'constantRegions',
      kind: 'constant_regions',
      value: legacy.constantRegions,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.45),
      summary: 'Legacy analyzer inferred constant regions from repeated sampled y-values.',
    }),
    turningPoints: createLegacyClaim({
      field: 'turningPoints',
      kind: 'turning_points',
      value: legacy.turningPoints,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.4),
      summary: 'Legacy analyzer inferred turning points from sampled slope sign changes.',
    }),
    isConstant: createLegacyClaim({
      field: 'isConstant',
      kind: 'constant_function',
      value: legacy.isConstant,
      samples,
      scope,
      confidence: createVisualConfidence(visualEstimate, 0.45),
      summary: 'Legacy analyzer inferred constant-function status from sampled behavior regions.',
    }),
    overflowRegions: createLegacyClaim({
      field: 'overflowRegions',
      kind: 'overflow_regions',
      value: legacy.overflowRegions,
      samples,
      scope,
      confidence: createVisualConfidence('Observed where sampled y-values exceeded the display threshold.', 0.6),
      summary: 'Legacy analyzer recorded viewport regions clipped by display overflow handling.',
    }),
  };

  return {
    legacy,
    claims,
    source: LEGACY_VISUAL_SOURCE,
  };
}
