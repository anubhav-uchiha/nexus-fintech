export const COMMISSION_PATTERNS = {
  CALCULATE: 'commission.calculate',

  CREATE_RULE: 'commission.rule.create',
  GET_RULE: 'commission.rule.get',
  GET_RULES: 'commission.rule.list',
  UPDATE_RULE: 'commission.rule.update',
  DELETE_RULE: 'commission.rule.delete',

  CREATE_DISTRIBUTION: 'commission.distribution.create',
  GET_DISTRIBUTIONS: 'commission.distribution.list',
  GET_DISTRIBUTION: 'commission.distribution.get',
  UPDATE_DISTRIBUTION: 'commission.distribution.update',
  DELETE_DISTRIBUTION: 'commission.distribution.delete',

  CREATE_HIERARCHY: 'commission.hierarchy.create',
  GET_ALL_HIERARCHY: 'commission.hierarchy.get-all',
  GET_ONE_HIERARCHY: 'commission.hierarchy.get-one',
  GET_PARENT_HIERARCHY: 'commission.hierarchy.get-parent',
  GET_CHILDREN_HIERARCHY: 'commission.hierarchy.get-children',
  UPDATE_HIERARCHY: 'commission.hierarchy.update',
  DELETE_HIERARCHY: 'commission.hierarchy.delete',

  RESOLVE_HIERARCHY: 'commission.hierarchy.resolve',
} as const;
