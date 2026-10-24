# 003 · Tareas

- [x] T1 Config `eventBridge` desde env + `.env.example` — *AC1.2, AC4.2*
- [x] T2 `EventBridgePublisher`: micro-batching, resultado por entrada, límite de tamaño, flush en shutdown — *AC2.1, AC2.3, AC3.1, AC3.2*
- [x] T3 `EventBridgeHandler` (`*`) con filtro `EVENTBRIDGE_TYPES` — *AC1.1, AC1.3*
- [x] T4 `EventBridgeModule` condicional e import en `AppModule` — *AC1.2*
- [x] T5 `infra/eventbridge.yaml` (bus, archive, policy) — *AC4.1*
- [x] T6 Verificación manual con endpoint falso de PutEvents: 25 eventos → lotes 10/10/5, filtro `EVENTBRIDGE_TYPES`,
  rechazo → 3 reintentos → DLQ, módulo omitido con `EVENTBRIDGE_ENABLED=false`
- [x] T7 README
- [ ] T8 Despliegue de `infra/eventbridge.yaml` en la cuenta AWS
- [ ] T9 Tests automatizados del publisher (lotes, fallo parcial, límite de tamaño)

## Enmienda 1 (propuesta)

- [ ] T10 Timeouts y reintentos configurables en `EventBridgeClient` — *AC5.1*
- [ ] T11 Comprobación de credenciales al arrancar con mensaje de diagnóstico — *AC5.2*
- [ ] T12 Validar `EVENTBRIDGE_BUS` como ARN y su región frente a `AWS_REGION` — *AC6.1*
- [ ] T13 `infra/eventbridge.yaml`: política de recurso del bus en lugar de managed policy — *AC6.2*
- [ ] T14 `infra/eventbridge-publisher.yaml` (cuenta B): rol + instance profile — *AC6.3*
- [ ] T15 Runbook de despliegue en README — *AC6.4*
- [ ] T16 Verificación: endpoint inalcanzable (≤ 15 s, el consumer sigue), sin credenciales (log), ARN de
  otra región (falla al arrancar), `ValidateTemplate` de ambas plantillas
