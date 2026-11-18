import type { Action, Resource, UserContext } from "@mill-ledger/shared";

export interface EvaluationContext {
  user: UserContext;
  resource: Resource;
  action: Action;
  resourceAttributes?: Record<string, unknown>;
  environment?: {
    ipAddress?: string;
    timestamp?: Date;
  };
}

export type PolicyRule = (context: EvaluationContext) => boolean;

const rules: PolicyRule[] = [
  // Inactive users are denied everything
  ({ user }) => user.isActive,

  // ABAC rule: salesmen can only modify their own draft orders
  ({ user, resource, action, resourceAttributes }) => {
    if (
      user.role === "salesman" &&
      resource === "order" &&
      action === "update"
    ) {
      const isOwner = resourceAttributes?.creatorId === user.id;
      const isDraft = resourceAttributes?.status === "draft";
      return Boolean(isOwner && isDraft);
    }
    return true;
  },
];

export function evaluateAbac(context: EvaluationContext): boolean {
  return rules.every((rule) => rule(context));
}
