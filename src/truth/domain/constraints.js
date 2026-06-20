export const CONSTRAINT_TYPES = {
  NOT_EQUAL: 'not_equal',
  GREATER_THAN_OR_EQUAL_ZERO: 'greater_than_or_equal_zero',
  GREATER_THAN_ZERO: 'greater_than_zero',
};

export function notEqualConstraint({ variable = 'x', value, expression = variable }) {
  return {
    type: CONSTRAINT_TYPES.NOT_EQUAL,
    variable,
    expression,
    value,
    display: `${expression} != ${formatNumber(value)}`,
  };
}

export function greaterThanOrEqualZeroConstraint({ expression }) {
  return {
    type: CONSTRAINT_TYPES.GREATER_THAN_OR_EQUAL_ZERO,
    expression,
    value: 0,
    display: `${expression} >= 0`,
  };
}

export function greaterThanZeroConstraint({ expression }) {
  return {
    type: CONSTRAINT_TYPES.GREATER_THAN_ZERO,
    expression,
    value: 0,
    display: `${expression} > 0`,
  };
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000000) / 1000000);
}
