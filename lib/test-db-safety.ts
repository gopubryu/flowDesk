export function assertSafeIntegrationDatabase(testDatabaseUrl: string | undefined, productionDatabaseUrl = process.env.DATABASE_URL) {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required for runtime integration tests");

  const testUrl = new URL(testDatabaseUrl);
  const productionUrl = productionDatabaseUrl ? new URL(productionDatabaseUrl) : null;
  const host = testUrl.hostname.toLowerCase();

  if (productionUrl && testUrl.href === productionUrl.href) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");
  }
  if (host.endsWith(".neon.tech") || host === "neon.tech") {
    throw new Error("Runtime integration tests require an isolated non-Production database");
  }
  if (!testUrl.password || !testUrl.username) {
    throw new Error("TEST_DATABASE_URL must include database credentials");
  }

  return testUrl;
}
