-- Datos demo para llenar gráficas (cuentas demo4..demo9). Montos del issue #4: $27.39/L, 70% + $10.
UPDATE users SET verificado = TRUE WHERE correo IN ('demo6@anahuac.mx','demo7@anahuac.mx','demo8@anahuac.mx','demo9@anahuac.mx');
DO $$
DECLARE
  r record; t_id uuid; tp_id uuid; rend numeric; gas numeric; pas numeric; tot numeric; cap numeric; com numeric;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- n, conductor, pasajero, km, estado_viaje, dias(+futuro/-pasado), estado_pasajero, estado_pago, km_cobrados_si_cancela
    (1,'demo4','demo5',17.0,'finalizado',-6,'completado','pagado',NULL),
    (2,'demo6','demo8',9.5,'finalizado',-6,'completado','pagado',NULL),
    (3,'demo7','demo9',22.0,'finalizado',-5,'completado','pagado',NULL),
    (4,'demo4','demo9',12.0,'finalizado',-5,'completado','pagado',NULL),
    (5,'demo6','demo5',14.0,'cancelado',-4,'rechazado','pagado',4.0),
    (6,'demo7','demo8',6.5,'finalizado',-4,'completado','pagado',NULL),
    (7,'demo4','demo8',11.0,'cancelado',-3,'rechazado','cancelado',NULL),
    (8,'demo6','demo9',18.5,'finalizado',-3,'completado','pagado',NULL),
    (9,'demo7','demo5',25.0,'finalizado',-2,'completado','pagado',NULL),
    (10,'demo4','demo5',8.0,'finalizado',-2,'completado','fallido',NULL),
    (11,'demo6','demo8',13.0,'finalizado',-1,'completado','pagado',NULL),
    (12,'demo7','demo9',16.0,'en_curso',0,'aceptado','retenido',NULL),
    (13,'demo4','demo8',10.0,'pendiente',1,'aceptado','retenido',NULL),
    (14,'demo6','demo5',20.0,'pendiente',2,'solicitado',NULL,NULL)
  ) AS v(n, cond, pasj, km, est, dias, est_p, est_pago, km_cancel)
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM trips WHERE precio_total IS NOT NULL AND distancia_km = r.km AND salida_en::date = (now() + make_interval(days => r.dias))::date
                            AND conductor_id = (SELECT id FROM users WHERE correo = r.cond || '@anahuac.mx'));
    SELECT c.rendimiento_km_l INTO rend FROM vehicles v JOIN vehicle_catalogo c ON c.categoria = v.categoria
      JOIN users u ON u.id = v.user_id WHERE u.correo = r.cond || '@anahuac.mx';
    gas := round(r.km / rend * 27.39, 2); pas := round(gas * 0.70, 2); tot := pas + 10;
    INSERT INTO trips (conductor_id, distancia_km, precio_total, precio_por_pasajero, capacidad_disponible, estado, fecha, salida_en, asientos_totales)
    SELECT u.id, r.km, gas, pas, 2, r.est::estado_viaje, now() + make_interval(days => r.dias, hours => -2),
           now() + make_interval(days => r.dias, hours => (r.n % 9) - 4), 3
      FROM users u WHERE u.correo = r.cond || '@anahuac.mx' RETURNING id INTO t_id;
    INSERT INTO trip_passengers (trip_id, pasajero_id, estado, monto_a_pagar)
    SELECT t_id, u.id, r.est_p::estado_pasajero, tot FROM users u WHERE u.correo = r.pasj || '@anahuac.mx' RETURNING id INTO tp_id;
    CONTINUE WHEN r.est_pago IS NULL;
    com := 10; cap := NULL;
    IF r.est_pago = 'pagado' AND r.km_cancel IS NOT NULL THEN
      cap := round(r.km_cancel / rend * 27.39 * 0.70, 2); com := 0;
    ELSIF r.est_pago = 'pagado' THEN cap := tot;
    ELSIF r.est_pago = 'cancelado' THEN cap := 0;
    END IF;
    INSERT INTO payments (trip_passenger_id, monto, estado, metodo, referencia_externa, fecha, km, rendimiento_km_l, precio_litro, gasolina, comision, monto_conductor, capturado)
    VALUES (tp_id, tot, r.est_pago::estado_pago, 'stripe (simulado)', 'pi_demo_gen_' || r.n, now() + make_interval(days => r.dias),
            r.km, rend, 27.39, gas, com, CASE WHEN cap IS NULL THEN pas ELSE cap - com END, cap);
  END LOOP;
END $$;
INSERT INTO ride_history (user_a_id, user_b_id, veces_juntos, ultimo_viaje)
SELECT DISTINCT ON (t.conductor_id, tp.pasajero_id) t.conductor_id, tp.pasajero_id, 1, t.salida_en
  FROM trips t JOIN trip_passengers tp ON tp.trip_id = t.id
 WHERE tp.estado = 'completado'
   AND NOT EXISTS (SELECT 1 FROM ride_history h WHERE h.user_a_id = t.conductor_id AND h.user_b_id = tp.pasajero_id);
