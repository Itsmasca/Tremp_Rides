import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { MatchingContractError, MatchingUnavailable } from './matching.errors';
import { MatchRequest, MatchResponse } from './matching.types';

/**
 * Cliente de `POST {MATCHING_URL}/match`. Único lugar que conoce los códigos HTTP de matching-py.
 * Sin reintentos: matching-py ya reintenta OSRM y cada intento emitiría otro `match.shown`.
 */
@Injectable()
export class MatchingClient {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<AppConfig, true>) {
    const matching = config.get('matching', { infer: true });
    this.url = `${matching.url.replace(/\/+$/, '')}/match`;
    this.timeoutMs = matching.timeoutMs;
  }

  async match(request: MatchRequest): Promise<MatchResponse> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason = (err as Error).name === 'TimeoutError' ? `timeout de ${this.timeoutMs} ms` : (err as Error).message;
      throw new MatchingUnavailable(`matching-py no responde: ${reason}`);
    }

    const body: unknown = await res.json().catch(() => undefined);

    if (res.status >= 500) throw new MatchingUnavailable(`matching-py respondió ${res.status}`);
    if (res.status !== 200) throw new MatchingContractError(`matching-py respondió ${res.status}`, body);

    if (!isMatchResponse(body)) throw new MatchingContractError('Respuesta de matching-py sin la forma del contrato', body);
    if (body.requestId !== request.requestId) {
      throw new MatchingContractError(`requestId distinto: enviado ${request.requestId}, recibido ${body.requestId}`, body);
    }
    return body;
  }
}

const isMatchResponse = (body: unknown): body is MatchResponse =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as MatchResponse).requestId === 'string' &&
  typeof (body as MatchResponse).modelVersion === 'string' &&
  Array.isArray((body as MatchResponse).candidates);
