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

/** Longest sender the provider accepts on the wire. */
const SENDER_MAX = 20;

/**
 * The name a message will actually go out under.
 *
 * The SMS page used to show `smsSenderName` while the send path ignored it,
 * so a school was told it sent as one name and sent as another. Both read
 * this now, so what is displayed is what is used — which matters, because
 * Hormuud rejects an unregistered name outright (code 203, "Invalid Sender
 * ID!!") and the name is the first thing to check.
 */
export function resolveSendingName(
  school: { name: string; smsSenderName?: string | null },
  gatewaySenderId?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const own = senderIdFeatureEnabled(env)
    ? school.smsSenderName?.trim()
    : undefined;
  return (
    own ||
    gatewaySenderId?.trim() ||
    school.name ||
    "eKulmis"
  ).slice(0, SENDER_MAX);
}
