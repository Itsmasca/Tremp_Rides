import { ConfigService } from '@nestjs/config';
import { MatchingClient } from '../../src/matching/matching.client';
import { MatchingContractError, MatchingUnavailable } from '../../src/matching/matching.errors';
import { MatchRequest } from '../../src/matching/matching.types';

const request: MatchRequest = {
  requestId: '7b1c2f0e-3d4a-4c8b-9a51-2f1e0c9d8a77',
  passengerId: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a',
  pickup: { lat: 21.0186, lng: -89.5847 },
  dropoff: { lat: 20.9671, lng: -89.6237 },
  departureAt: '2026-10-26T07:30:00-06:00',
  timeWindowMin: 30,
  limit: 10,
};

const config = { get: () => ({ url: 'http://matching-py:8000/', timeoutMs: 50 }) } as unknown as ConfigService<never, true>;

const reply = (status: number, body: unknown) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('MatchingClient', () => {
  const client = new MatchingClient(config);

  afterEach(() => jest.restoreAllMocks());

  it('envía el request del contrato a /match y devuelve la respuesta', async () => {
    const body = { requestId: request.requestId, modelVersion: 'heuristic-v1', candidates: [] };
    const fetchSpy = reply(200, body);

    await expect(client.match(request)).resolves.toEqual(body);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://matching-py:8000/match');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(request);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([503, 500, 502])('%i de matching-py → MatchingUnavailable', async (status) => {
    reply(status, { detail: 'routing engine unavailable' });
    await expect(client.match(request)).rejects.toBeInstanceOf(MatchingUnavailable);
  });

  it('error de red → MatchingUnavailable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(client.match(request)).rejects.toBeInstanceOf(MatchingUnavailable);
  });

  it('timeout → MatchingUnavailable', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))),
    );
    await expect(client.match(request)).rejects.toThrow(/timeout de 50 ms/);
  });

  it('422 → MatchingContractError con el cuerpo', async () => {
    const detail = [{ loc: ['body', 'pickup'], msg: 'fuera del bbox', type: 'value_error.out_of_bbox' }];
    reply(422, { detail });

    const err = await client.match(request).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MatchingContractError);
    expect((err as MatchingContractError).body).toEqual({ detail });
  });

  it('requestId distinto → MatchingContractError', async () => {
    reply(200, { requestId: 'otro', modelVersion: 'heuristic-v1', candidates: [] });
    await expect(client.match(request)).rejects.toBeInstanceOf(MatchingContractError);
  });

  it('200 sin candidates → MatchingContractError', async () => {
    reply(200, { requestId: request.requestId, modelVersion: 'heuristic-v1' });
    await expect(client.match(request)).rejects.toBeInstanceOf(MatchingContractError);
  });
});
