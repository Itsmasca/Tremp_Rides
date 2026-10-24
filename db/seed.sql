--  MayaRide - Datos de prueba (seed)

-- Configuracion: precio de gasolina de referencia (semi-automatiza el calculo)
INSERT INTO config (clave, valor, descripcion) VALUES
    ('precio_litro_gasolina', '24.00', 'Precio de referencia por litro (MXN)'),
    ('moneda', 'MXN', 'Moneda del sistema');

-- Usuarios demo (password_hash es solo ilustrativo; en real usar bcrypt/argon2)
INSERT INTO users (nombre, correo, password_hash, sexo, tipo_usuario, verificado, pref_sexo_viaje) VALUES
    ('Demo Uno',    'demo1@anahuac.mx',    '$2b$12$demohashdemohashdemoha', 'F', 'conductor', TRUE, 'solo_F'),
    ('Demo dos',   'demo2@anahuac.mx',   '$2b$12$demohashdemohashdemoha', 'M', 'pasajero',  TRUE, 'cualquiera'),
    ('Demo Tres', 'demo3@anahuac.mx', '$2b$12$demohashdemohashdemoha', 'F', 'pasajero',  TRUE, 'solo_F');

-- Coche de Ana (conductora)
INSERT INTO vehicles (user_id, marca, modelo, capacidad, categoria)
SELECT id, 'Nissan', 'Versa', 4, 'sedan'
FROM users WHERE correo = 'demo1@anahuac.mx';

-- Ejemplo de viaje de Ana: 20 km
--   costo = (20 / 14.5) * 24 = $33.10 total
--   si van 2 pasajeros -> ~$16.55 c/u (mucho mas barato que Uber)
INSERT INTO trips (conductor_id, distancia_km, precio_total, precio_por_pasajero, capacidad_disponible, estado)
SELECT id, 20.0, 33.10, 16.55, 2, 'pendiente'
FROM users WHERE correo = 'demo1@anahuac.mx';
