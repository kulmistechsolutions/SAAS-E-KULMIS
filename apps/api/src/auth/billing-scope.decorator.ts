import { SetMetadata } from "@nestjs/common";

export const BILLING_SCOPE_KEY = "billingScope";

/**
 * This route may be reached with a renewal-only token.
 *
 * A school whose subscription has lapsed is signed out of everything; the
 * token it gets instead opens the handful of routes that let it look at the
 * plans and pay for one. Every other route refuses that token, so marking one
 * here is a deliberate decision about what a school with no live plan may do,
 * not a side effect of where the code happened to go.
 */
export const BillingScope = () => SetMetadata(BILLING_SCOPE_KEY, true);
