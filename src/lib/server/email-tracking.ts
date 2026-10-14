/** Never replace outbound URLs with SendGrid click-tracking redirect URLs. */
export function emailTrackingSettings() {
  return { clickTracking: { enable: false, enableText: false } };
}
