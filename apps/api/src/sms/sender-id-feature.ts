/**
 * Whether schools may hold a sending name of their own.
 *
 * Turned off after messages sent under an approved name came back refused:
 * approving a name in this platform does not register it with the operator,
 * and an unregistered name is rejected outright. With the feature off, sends
 * fall back to the name the gateway is configured with — the chain that was
 * in place before, and the one that has been answered with a success.
 *
 * Off is the default. Set SMS_SENDER_ID_ENABLED=true to restore the
 * application-and-approval flow once names are registered with the operator;
 * nothing about it was deleted, and approved names are still stored.
 */
export function senderIdFeatureEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return String(env.SMS_SENDER_ID_ENABLED ?? "").trim().toLowerCase() === "true";
}
