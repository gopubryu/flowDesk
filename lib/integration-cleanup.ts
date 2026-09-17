export function combineIntegrationErrors(primaryError: unknown, cleanupErrors: unknown[]): unknown {
  if (primaryError !== undefined && cleanupErrors.length > 0) {
    return new AggregateError([primaryError, ...cleanupErrors], "Integration test and fixture cleanup failed", {
      cause: primaryError,
    });
  }
  if (primaryError !== undefined) return primaryError;
  if (cleanupErrors.length > 0) {
    return new AggregateError(cleanupErrors, "Integration fixture cleanup failed");
  }
  return undefined;
}
