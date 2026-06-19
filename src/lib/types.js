// ============================================
// AXIOM INSIGHT OBJECT — TYPE DEFINITIONS
// V1: Sampling-based analysis
// V2: Symbolic analysis hooks (future)
// ============================================

/**
 * Complete analysis result for a function
 * @typedef {Object} InsightObject
 */

// ---- DOMAIN ----
/**
 * @typedef {Object} DomainInterval
 * @property {number|'-inf'} from
 * @property {number|'+inf'} to
 * @property {boolean} fromOpen - true = open bracket (
 * @property {boolean} toOpen  - true = open bracket )
 */

/**
 * @typedef {Object} DomainResult
 * @property {'all_reals'|'restricted'|'discrete'|'unknown'} type
 * @property {DomainInterval[]} intervals - valid intervals
 * @property {number[]} excludedPoints
 * @property {string} displayString - e.g. "(0, ∞)" or "ℝ \ {0}"
 * @property {'sampling_v1'|'symbolic_v2'} source
 * @property {number} confidence - 0 to 1
 */

// ---- RANGE ----
/**
 * @typedef {Object} RangeResult
 * @property {number} min
 * @property {number} max
 * @property {string} note - e.g. "visible range only"
 */

// ---- CONTINUITY ----
/**
 * @typedef {Object} DiscontinuityPoint
 * @property {number} x
 * @property {'jump'|'removable'|'vertical_asymptote'|'unknown'} type
 */

/**
 * @typedef {Object} ContinuityResult
 * @property {'continuous'|'jump'|'removable'|'asymptote'|'mixed'|'unknown'} overall
 * @property {DiscontinuityPoint[]} discontinuities
 */

// ---- ASYMPTOTES ----
/**
 * @typedef {Object} AsymptoteResult
 * @property {number[]} vertical   - x values
 * @property {number[]} horizontal - y values
 * @property {Array}    oblique    - future: {slope, intercept}
 */

// ---- BEHAVIOR (MONOTONICITY) ----
/**
 * @typedef {Object} BehaviorInterval
 * @property {[number, number]} range - [start, end]
 * @property {'strictly_increasing'|'strictly_decreasing'|'non_decreasing'|'non_increasing'|'constant'|'piecewise_constant'|'mixed'} type
 */

/**
 * @typedef {Object} BehaviorResult
 * @property {BehaviorInterval[]} intervals
 */

// ---- SYMMETRY ----
/**
 * @typedef {Object} SymmetryResult
 * @property {'even'|'odd'|'neither'} type
 * @property {number} confidence - 0 to 1
 */

// ---- TURNING POINTS ----
/**
 * @typedef {Object} TurningPoint
 * @property {number} x
 * @property {number} y
 * @property {'local_min'|'local_max'|'unknown'} type
 * @property {'approximate'|'refined'} confidence
 */

// ---- SPECIAL FEATURES ----
/**
 * @typedef {'periodic'|'piecewise'|'oscillatory'|'bounded'|'unbounded'|'discrete'|'continuous'} SpecialFeature
 */

// ---- WARNINGS ----
/**
 * @typedef {Object} Warning
 * @property {'sampling_limit'|'overflow'|'low_confidence'|'clipped'} type
 * @property {string} message
 */

// ---- FULL INSIGHT OBJECT ----
/**
 * @typedef {Object} InsightObject
 * @property {DomainResult}     domain
 * @property {RangeResult}      range
 * @property {ContinuityResult} continuity
 * @property {AsymptoteResult}  asymptotes
 * @property {BehaviorResult}   behavior
 * @property {SymmetryResult}   symmetry
 * @property {TurningPoint[]}   turningPoints
 * @property {SpecialFeature[]} specialFeatures
 * @property {string[]}         mathematicalFacts  ← AI sirf yahi use karega
 * @property {Warning[]}        warnings
 * @property {Object}           meta
 * @property {string}           meta.analysisVersion
 * @property {number}           meta.samplingStep
 * @property {[number,number]}  meta.viewRange
 */

// ---- EMPTY INSIGHT (default/error state) ----
export function createEmptyInsight() {
  return {
    domain: {
      type: 'unknown',
      intervals: [],
      excludedPoints: [],
      displayString: 'Unknown',
      source: 'sampling_v1',
      confidence: 0,
    },
    range: { min: 0, max: 0, note: 'no data' },
    continuity: { overall: 'unknown', discontinuities: [] },
    asymptotes: { vertical: [], horizontal: [], oblique: [] },
    behavior: { intervals: [] },
    symmetry: { type: 'neither', confidence: 0 },
    turningPoints: [],
    specialFeatures: [],
    mathematicalFacts: [],
    warnings: [],
    meta: {
      analysisVersion: '2.0',
      samplingStep: 0.1,
      viewRange: [-10, 10],
    },
  };
}