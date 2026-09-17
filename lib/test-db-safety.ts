export function assertSafeIntegrationDatabase(testDatabaseUrl: string | undefined, productionDatabaseUrl = process.env.DATABASE_URL) {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required for runtime integration tests");

  const testUrl = new URL(testDatabaseUrl);
  const productionUrl = productionDatabaseUrl ? new URL(productionDatabaseUrl) : null;
  const host = testUrl.hostname.toLowerCase();
  const loopbackHosts = ["127.0.0.1", "localhost", "::1"];
  const databaseName = decodeURIComponent(testUrl.pathname.replace(/^\/+/, ""));
  const isTestDatabaseName = databaseName === "flowdesk_test" || databaseName.endsWith("_test");

  if (!loopbackHosts.includes(host) || !isTestDatabaseName) {
    throw new Error("TEST_DATABASE_URL must use a loopback host and test-only database name");
  }

  if (productionUrl && testUrl.href === productionUrl.href) {
    const isIsolatedLoopback = process.env.INTEGRATION_TEST === "1" && loopbackHosts.includes(host) && isTestDatabaseName;
    if (!isIsolatedLoopback) throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");
  }
  if (!testUrl.password || !testUrl.username) {
    throw new Error("TEST_DATABASE_URL must include database credentials");
  }

  return testUrl;
}
