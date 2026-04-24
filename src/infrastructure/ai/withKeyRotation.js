/**
 * Retry an AI API call with primary/backup key rotation.
 *
 * @param {object[]} clients  - Ordered array of EchanApiClient instances (primary first).
 * @param {function}  fn      - async (client) => result. Throw on failure.
 * @param {object}   [opts]
 * @param {number}   [opts.maxRetriesPerKey=3]  - Max attempts before switching key.
 * @param {number}   [opts.maxTotalAttempts=6]  - Hard cap across all keys.
 * @returns {Promise<*>} Resolves with the first successful result, or rejects when
 *                       all attempts are exhausted.
 */
async function withKeyRotation(clients, fn, opts = {}) {
  if (!clients || clients.length === 0) {
    throw new Error('withKeyRotation: clients array must not be empty');
  }
  const maxRetriesPerKey = opts.maxRetriesPerKey ?? 3;
  const maxTotalAttempts = opts.maxTotalAttempts ?? clients.length * maxRetriesPerKey;
  const switchOnStatuses = new Set(
    Array.isArray(opts.switchOnStatuses) && opts.switchOnStatuses.length > 0
      ? opts.switchOnStatuses
      : [400]
  );

  let clientIndex = 0;
  let attemptsOnCurrentClient = 0;
  let totalAttempts = 0;
  let lastError = null;

  while (totalAttempts < maxTotalAttempts && clientIndex < clients.length) {
    const client = clients[clientIndex];
    try {
      attemptsOnCurrentClient++;
      totalAttempts++;
      return await fn(client);
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const shouldSwitchClient = switchOnStatuses.has(status);
      const hasAnotherClient = clientIndex < clients.length - 1;
      if (shouldSwitchClient) {
        if (hasAnotherClient) {
          console.log(`API key rotation: got ${status} on attempt ${totalAttempts}/${maxTotalAttempts}, switching key`);
        } else {
          console.log(`API request got ${status} on attempt ${totalAttempts}/${maxTotalAttempts}, no backup key available`);
        }
      } else {
        console.error(`API call failed (attempt ${totalAttempts}/${maxTotalAttempts}):`, error.message || error);
      }

      const exhaustedCurrentKey =
        shouldSwitchClient || attemptsOnCurrentClient >= maxRetriesPerKey;

      if (exhaustedCurrentKey && hasAnotherClient) {
        clientIndex++;
        attemptsOnCurrentClient = 0;
        console.log(`Switching to API client #${clientIndex + 1}`);
      } else if (shouldSwitchClient || totalAttempts >= maxTotalAttempts || attemptsOnCurrentClient >= maxRetriesPerKey) {
        break;
      }
    }
  }

  const finalError = new Error('withKeyRotation: all attempts exhausted');
  finalError.cause = lastError;
  throw finalError;
}

module.exports = { withKeyRotation };
