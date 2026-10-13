/** Never derive credential destinations from untrusted request headers. */
export function resolveBaseUrl(config: {
  NODE_ENV?: string;
  BASE_URL?: string;
  REPLIT_DEV_DOMAIN?: string;
  REPLIT_DOMAINS?: string;
}) {
  // Forks inherit configuration, but have their own runtime-managed preview host.
  if (config.NODE_ENV !== "production" && config.REPLIT_DEV_DOMAIN) {
    return `https://${config.REPLIT_DEV_DOMAIN}`;
  }
  if (config.BASE_URL) return config.BASE_URL.replace(/\/$/, "");
  const domain = config.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  return "http://localhost:5000";
}
