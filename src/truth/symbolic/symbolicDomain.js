import { parse } from 'mathjs';
import {
  POSITIVE_INFINITY,
  NEGATIVE_INFINITY,
  allReals,
  createDomainSet,
  createInterval,
  excludedPoints,
  removePoint,
} from '../domain/domainSet.js';
import { formatDomainSet } from '../domain/domainFormatter.js';
import {
  greaterThanOrEqualZeroConstraint,
  greaterThanZeroConstraint,
  notEqualConstraint,
} from '../domain/constraints.js';
import {
  CONFIDENCE_LEVELS,
  SOURCE_TYPES,
  createClaim,
  createConfidence,
  createEvidence,
  createProvenanceSource,
  createScope,
} from '../models.js';

const SYMBOLIC_DOMAIN_SOURCE = createProvenanceSource({
  type: SOURCE_TYPES.SYMBOLIC_PROVEN,
  engine: 'symbolicDomainV1',
  method: 'supported_ast_domain_constraints',
  version: '1.0',
});

const UNKNOWN_DOMAIN_SOURCE = createProvenanceSource({
  type: SOURCE_TYPES.UNKNOWN,
  engine: 'symbolicDomainV1',
  method: 'unsupported_ast_shape',
  version: '1.0',
});

function unwrap(node) {
  return node?.type === 'ParenthesisNode' ? unwrap(node.content) : node;
}

function isConstant(node, value = null) {
  const clean = unwrap(node);
  if (clean?.type !== 'ConstantNode') return false;
  if (value === null) return true;
  return Number(clean.value) === value;
}

function isSymbolX(node) {
  const clean = unwrap(node);
  return clean?.type === 'SymbolNode' && clean.name === 'x';
}

function getConstantValue(node) {
  return Number(unwrap(node)?.value);
}

function linearConstraint(node) {
  const clean = unwrap(node);

  if (isSymbolX(clean)) {
    return { a: 1, b: 0, description: 'x' };
  }

  if (clean?.type !== 'OperatorNode') return null;

  const [left, right] = clean.args.map(unwrap);

  if (clean.op === '-' && isSymbolX(left) && isConstant(right)) {
    const c = getConstantValue(right);
    return { a: 1, b: -c, description: `x - ${c}` };
  }

  if (clean.op === '-' && isConstant(left) && isSymbolX(right)) {
    const c = getConstantValue(left);
    return { a: -1, b: c, description: `${c} - x` };
  }

  if (clean.op === '+' && isSymbolX(left) && isConstant(right)) {
    const c = getConstantValue(right);
    return { a: 1, b: c, description: `x + ${c}` };
  }

  if (clean.op === '+' && isConstant(left) && isSymbolX(right)) {
    const c = getConstantValue(left);
    return { a: 1, b: c, description: `${c} + x` };
  }

  return null;
}

function solveLinearBoundary({ a, b }) {
  if (a === 0) return null;
  return -b / a;
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000000) / 1000000);
}

function domainExcluding(points) {
  const excludedPoints = [...new Set(points)].sort((a, b) => a - b);
  const domainSet = excludedPoints.reduce(
    (current, point) => removePoint(current, point),
    allReals(),
  );

  return {
    type: excludedPoints.length ? 'restricted' : 'all_reals',
    displayString: formatDomainSet(domainSet),
    domainSet,
    intervals: domainSet.intervals,
    excludedPoints,
    constraints: excludedPoints.map((point) => notEqualConstraint({ value: point })),
  };
}

function domainFromInequality(linear, operator) {
  const boundary = solveLinearBoundary(linear);
  if (boundary === null) return null;

  const isGreaterSide = linear.a > 0;
  const inclusive = operator === '>=';
  const domainSet = createDomainSet([
    isGreaterSide
      ? createInterval(boundary, POSITIVE_INFINITY, { fromOpen: !inclusive, toOpen: true })
      : createInterval(NEGATIVE_INFINITY, boundary, { fromOpen: true, toOpen: !inclusive }),
  ]);
  const sign = isGreaterSide
    ? (inclusive ? '>=' : '>')
    : (inclusive ? '<=' : '<');
  const constraint = inclusive
    ? greaterThanOrEqualZeroConstraint({ expression: linear.description })
    : greaterThanZeroConstraint({ expression: linear.description });

  return {
    type: 'restricted',
    displayString: `x ${sign} ${formatNumber(boundary)}`,
    domainSet,
    intervals: domainSet.intervals,
    excludedPoints: excludedPoints(domainSet),
    constraints: [{
      ...constraint,
      boundary,
      display: `x ${sign} ${formatNumber(boundary)}`,
    }],
  };
}

function denominatorZeros(node) {
  const clean = unwrap(node);

  if (isSymbolX(clean)) return [0];

  const linear = linearConstraint(clean);
  if (linear) return [solveLinearBoundary(linear)];

  if (clean?.type === 'OperatorNode' && clean.op === '-') {
    const [left, right] = clean.args.map(unwrap);
    if (
      left?.type === 'OperatorNode' &&
      left.op === '^' &&
      isSymbolX(left.args[0]) &&
      isConstant(left.args[1], 2) &&
      isConstant(right)
    ) {
      const c = getConstantValue(right);
      if (c > 0) {
        const root = Math.sqrt(c);
        return [-root, root];
      }
      if (c === 0) return [0];
    }
  }

  return null;
}

function analyzeRationalDomain(ast) {
  const clean = unwrap(ast);
  if (clean?.type !== 'OperatorNode' || clean.op !== '/') return null;

  const zeros = denominatorZeros(clean.args[1]);
  if (!zeros) return null;

  return {
    domain: domainExcluding(zeros),
    evidence: createEvidence({
      type: 'ast_pattern',
      summary: 'Domain excludes real zeros of the denominator.',
      data: {
        denominator: unwrap(clean.args[1]).toString(),
        zeros,
      },
    }),
  };
}

function analyzeRootOrLogDomain(ast) {
  const clean = unwrap(ast);
  if (clean?.type !== 'FunctionNode') return null;

  const functionName = clean.fn?.name;
  const isSqrt = functionName === 'sqrt';
  const isLog = functionName === 'log' || functionName === 'ln';
  if (!isSqrt && !isLog) return null;
  if (clean.args.length !== 1) return null;

  const linear = linearConstraint(clean.args[0]);
  if (!linear) return null;

  const operator = isSqrt ? '>=' : '>';
  const domain = domainFromInequality(linear, operator);
  if (!domain) return null;

  return {
    domain,
    evidence: createEvidence({
      type: 'ast_pattern',
      summary: isSqrt
        ? 'Square root requires the radicand to be non-negative.'
        : 'Logarithm requires the argument to be positive.',
      data: {
        functionName,
        argument: unwrap(clean.args[0]).toString(),
        constraint: `${linear.description} ${operator} 0`,
      },
    }),
  };
}

function createSymbolicDomainClaim({ expression, domain, evidence }) {
  const scope = createScope({
    viewport: null,
    global: true,
  });

  return createClaim({
    id: 'symbolic.domain',
    kind: 'domain',
    value: domain,
    confidence: createConfidence({
      level: CONFIDENCE_LEVELS.CERTAIN,
      score: 1,
      reason: 'Domain was derived from a supported expression structure using exact algebraic constraints.',
    }),
    source: SYMBOLIC_DOMAIN_SOURCE,
    evidence: [
      createEvidence({
        type: 'ast_pattern',
        summary: 'Expression matched a supported Symbolic Domain V1 pattern.',
        data: { expression },
        scope,
      }),
      { ...evidence, scope },
    ],
    scope,
    status: 'resolved',
  });
}

function createUnknownDomainClaim({ expression, warning }) {
  const scope = createScope({
    viewport: null,
    global: true,
  });

  return createClaim({
    id: 'symbolic.domain.unknown',
    kind: 'domain',
    value: {
      type: 'unknown',
      displayString: 'Unknown',
      intervals: [],
      excludedPoints: [],
      constraints: [],
    },
    confidence: createConfidence({
      level: CONFIDENCE_LEVELS.UNKNOWN,
      score: 0,
      reason: 'Symbolic Domain V1 does not support this expression shape.',
    }),
    source: UNKNOWN_DOMAIN_SOURCE,
    evidence: [
      createEvidence({
        type: 'failed_check',
        summary: warning.message,
        data: { expression },
        scope,
      }),
    ],
    scope,
    status: 'unknown',
    warnings: [warning],
  });
}

export function analyzeSymbolicDomain(expression) {
  const trimmed = expression?.trim();
  if (!trimmed) {
    return createUnknownDomainClaim({
      expression: expression || '',
      warning: {
        type: 'empty_expression',
        message: 'No expression was provided for symbolic domain analysis.',
      },
    });
  }

  let ast;
  try {
    ast = parse(trimmed);
  } catch {
    return createUnknownDomainClaim({
      expression: trimmed,
      warning: {
        type: 'parse_error',
        message: 'Expression could not be parsed for symbolic domain analysis.',
      },
    });
  }

  const rational = analyzeRationalDomain(ast);
  if (rational) {
    return createSymbolicDomainClaim({
      expression: trimmed,
      domain: rational.domain,
      evidence: rational.evidence,
    });
  }

  const rootOrLog = analyzeRootOrLogDomain(ast);
  if (rootOrLog) {
    return createSymbolicDomainClaim({
      expression: trimmed,
      domain: rootOrLog.domain,
      evidence: rootOrLog.evidence,
    });
  }

  return createUnknownDomainClaim({
    expression: trimmed,
    warning: {
      type: 'unsupported_symbolic_domain_v1',
      message: 'Symbolic Domain V1 only supports simple rational functions, square roots, and logarithms with linear arguments.',
    },
  });
}
