/** matching-py caído, lento o con 5xx (incluye su 503 por OSRM). → 503 al cliente. */
export class MatchingUnavailable extends Error {
  override readonly name = 'MatchingUnavailable';
}

/** matching-py respondió algo que no cumple el contrato (4xx o cuerpo inesperado). → 502 al cliente. */
export class MatchingContractError extends Error {
  override readonly name = 'MatchingContractError';

  constructor(message: string, readonly body?: unknown) {
    super(message);
  }
}
