--  LionRide - Gestion de la informacion de la comunidad
--  DML de ejemplo: operaciones tipicas sobre los usuarios (comunidad Anahuac)
--
--  "Comunidad" = alumnos de la Anahuac registrados en la app.
--  Estas operaciones cubren el alta, consulta, actualizacion y baja.
--
--  NOTA: todos los datos son DEMO / ficticios (demo1, demo2, ...).
--        No corresponden a personas reales.

--  1. ALTA  (INSERT) - Registrar un nuevo miembro de la comunidad

-- 1.1 Registrar un PASAJERO (sin coche)
INSERT INTO users (nombre, correo, password_hash, sexo, tipo_usuario, verificado, pref_sexo_viaje)
VALUES ('Demo Pasajero Uno', 'demo1@anahuac.mx', '$2b$12$hashgeneradoporbcrypt', 'F', 'pasajero', FALSE, 'solo_F');

-- 1.2 Registrar un CONDUCTOR (con coche) -> se inserta en users y luego su vehicle
WITH nuevo_conductor AS (
    INSERT INTO users (nombre, correo, password_hash, sexo, tipo_usuario, verificado, pref_sexo_viaje)
    VALUES ('Demo Conductor Dos', 'demo2@anahuac.mx', '$2b$12$hashgeneradoporbcrypt', 'M', 'conductor', FALSE, 'cualquiera')
    RETURNING id
)
INSERT INTO vehicles (user_id, marca, modelo, capacidad, rendimiento_km_l)
SELECT id, 'MarcaDemo', 'ModeloDemo', 4, 15.00 FROM nuevo_conductor;

--  2. CONSULTA  (SELECT) - Gestionar / ver la comunidad

-- 2.1 Listar todos los conductores disponibles (lado de la "oferta")
SELECT u.nombre, u.correo, v.marca, v.modelo, v.capacidad, v.rendimiento_km_l
FROM users u
JOIN vehicles v ON v.user_id = u.id
WHERE u.tipo_usuario = 'conductor'
  AND u.verificado = TRUE
ORDER BY u.nombre;

-- 2.2 Listar pasajeros que solo quieren viajar con mujeres
SELECT nombre, correo, sexo
FROM users
WHERE tipo_usuario = 'pasajero'
  AND pref_sexo_viaje = 'solo_F';

-- 2.3 Contar la comunidad por tipo de usuario (para metricas / pitch)
SELECT tipo_usuario, COUNT(*) AS total
FROM users
GROUP BY tipo_usuario;

-- 2.4 Verificar que un correo pertenece a la comunidad Anahuac
--     (el CHECK ya lo garantiza al insertar, esto es para validar en consulta)
SELECT id, nombre, verificado
FROM users
WHERE correo = 'demo1@anahuac.mx'
  AND correo ~* '@anahuac\.mx$';

-- 2.5 Ver con quienes ha viajado un usuario (confianza / preferencia)
SELECT u.nombre AS compañero, rh.veces_juntos, rh.ultimo_viaje
FROM ride_history rh
JOIN users u ON u.id = rh.user_b_id
WHERE rh.user_a_id = (SELECT id FROM users WHERE correo = 'demo2@anahuac.mx')
ORDER BY rh.veces_juntos DESC;

--  3. ACTUALIZACION  (UPDATE) - Gestionar cambios en la comunidad

-- 3.1 Verificar a un usuario (tras confirmar su correo @anahuac.mx)
UPDATE users
SET verificado = TRUE
WHERE correo = 'demo1@anahuac.mx';

-- 3.2 Cambiar la preferencia de con quien quiere viajar
UPDATE users
SET pref_sexo_viaje = 'cualquiera'
WHERE correo = 'demo1@anahuac.mx';

-- 3.3 Actualizar la foto de perfil (URL de S3)
UPDATE users
SET foto_url = 'https://lionride-fotos.s3.amazonaws.com/demo1.jpg'
WHERE correo = 'demo1@anahuac.mx';

-- 3.4 Un pasajero consigue coche -> pasa a conductor y registra su vehiculo
UPDATE users
SET tipo_usuario = 'conductor'
WHERE correo = 'demo1@anahuac.mx';

INSERT INTO vehicles (user_id, marca, modelo, capacidad, rendimiento_km_l)
SELECT id, 'MarcaDemo2', 'ModeloDemo2', 4, 13.50
FROM users WHERE correo = 'demo1@anahuac.mx';

--  4. BAJA  (DELETE) - Dar de baja a un miembro de la comunidad
--     Gracias a ON DELETE CASCADE, se borran tambien su vehiculo,
--     viajes, pasajes e historial relacionados.

DELETE FROM users
WHERE correo = 'demo1@anahuac.mx';

--  5. REGISTRO DE CONFIANZA  (INSERT / UPDATE sobre ride_history)
--     Cada vez que dos personas viajan juntas, se registra o incrementa.

-- Inserta el par; si ya existe, incrementa veces_juntos y actualiza la fecha
INSERT INTO ride_history (user_a_id, user_b_id, veces_juntos, ultimo_viaje)
VALUES (
    (SELECT id FROM users WHERE correo = 'demo2@anahuac.mx'),
    (SELECT id FROM users WHERE correo = 'demo3@anahuac.mx'),
    1, now()
)
ON CONFLICT (user_a_id, user_b_id)
DO UPDATE SET
    veces_juntos = ride_history.veces_juntos + 1,
    ultimo_viaje = now();
