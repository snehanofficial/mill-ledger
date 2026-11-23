const rules = [
    // Inactive users are denied everything
    ({ user }) => user.isActive,
    // ABAC rule: salesmen can only modify their own draft orders
    ({ user, resource, action, resourceAttributes }) => {
        if (user.role === "SALESMAN" &&
            resource === "order" &&
            action === "update") {
            const isOwner = resourceAttributes?.creatorId === user.id;
            const statusStr = typeof resourceAttributes?.status === "string"
                ? resourceAttributes.status.toUpperCase()
                : "";
            const isDraft = statusStr === "DRAFT";
            return Boolean(isOwner && isDraft);
        }
        return true;
    },
    // ABAC rule: salesmen can only read their own orders when resource attributes specify ownership
    ({ user, resource, action, resourceAttributes }) => {
        if (user.role === "SALESMAN" &&
            resource === "order" &&
            action === "read" &&
            resourceAttributes?.creatorId) {
            return resourceAttributes.creatorId === user.id;
        }
        return true;
    },
    // ABAC rule: salesmen can only read their assigned customers
    ({ user, resource, action, resourceAttributes }) => {
        if (user.role === "SALESMAN" &&
            resource === "customer" &&
            action === "read" &&
            resourceAttributes?.assignedSalesmanId) {
            return resourceAttributes.assignedSalesmanId === user.id;
        }
        return true;
    },
    // ABAC rule: immutable posted records cannot be directly edited or deleted
    ({ action, resourceAttributes }) => {
        if ((action === "update" || action === "delete") &&
            resourceAttributes?.status) {
            const statusStr = typeof resourceAttributes.status === "string"
                ? resourceAttributes.status.toUpperCase()
                : "";
            if (statusStr === "POSTED") {
                return false;
            }
        }
        return true;
    },
];
export function evaluateAbac(context) {
    return rules.every((rule) => rule(context));
}
