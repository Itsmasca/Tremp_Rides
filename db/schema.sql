--  Trents - Esquema de base de datos (PostgreSQL)
--  App de matching de rutas casa -> uni (carpooling universitario)
--
--  PRINCIPIO DE PRIVACIDAD:
--    - NO se almacena la ubicacion del usuario en esta BD.
--    - La ruta / ubicacion actual vive en Redis (ElastiCache) con TTL
--      y se "reinicia" sola. Aqui solo guardamos distancia_km (un numero).

-- Extension para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tipos ENUM
CREATE TYPE sexo_tipo            AS ENUM ('M', 'F', 'otro');
CREATE TYPE usuario_tipo         AS ENUM ('conductor', 'pasajero');
CREATE TYPE pref_sexo_tipo       AS ENUM ('cualquiera', 'solo_M', 'solo_F');
CREATE TYPE estado_viaje         AS ENUM ('pendiente', 'en_curso', 'finalizado', 'cancelado');
CREATE TYPE estado_pasajero      AS ENUM ('solicitado', 'aceptado', 'rechazado', 'completado');
CREATE TYPE estado_pago          AS ENUM ('pendiente', 'pagado', 'fallido');

-- Tabla de configuracion (precio de gasolina de referencia, etc.)
-- Permite "semi-automatizar" el calculo sin pedir el precio cada vez.
CREATE TABLE config (
    clave       TEXT PRIMARY KEY,
    valor       TEXT NOT NULL,
    descripcion TEXT
);

-- USERS  (datos permanentes)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    correo          TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    sexo            sexo_tipo NOT NULL,
    foto_url        TEXT,                       -- URL/key en S3 (la imagen NO se guarda en BD)
    tipo_usuario    usuario_tipo NOT NULL,
    verificado      BOOLEAN NOT NULL DEFAULT FALSE,
    pref_sexo_viaje pref_sexo_tipo NOT NULL DEFAULT 'cualquiera',
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Verificacion de dominio: solo correos @anahuac.mx
    CONSTRAINT chk_correo_anahuac
        CHECK (correo ~* '^[A-Za-z0-9._%+-]+@anahuac\.mx$'),

    -- Regla: la opcion "solo rides de mujeres" solo aplica a usuarias (sexo = 'F').
    -- La app solo debe MOSTRAR esta pregunta cuando sexo = 'F'; aqui lo reforzamos.
    CONSTRAINT chk_pref_solo_mujeres
        CHECK (pref_sexo_viaje <> 'solo_F' OR sexo = 'F')
);

-- VEHICLES  (solo si el usuario es conductor)
CREATE TABLE vehicles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    marca             TEXT,
    modelo            TEXT,
    capacidad         SMALLINT NOT NULL CHECK (capacidad > 0),   -- nro de pasajeros
    rendimiento_km_l  NUMERIC(5,2) NOT NULL CHECK (rendimiento_km_l > 0), -- para media de gasolina
    tipo_combustible  TEXT DEFAULT 'magna',
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_vehicle_user UNIQUE (user_id)   -- 1 coche por usuario (hackathon)
);

-- TRIPS  (un viaje concreto casa -> uni)
--   OJO: distancia_km es un NUMERO, nunca coordenadas ni origen/destino.
CREATE TABLE trips (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conductor_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    distancia_km           NUMERIC(6,2) NOT NULL CHECK (distancia_km > 0),
    precio_total           NUMERIC(8,2),          -- media de gasolina del trayecto
    precio_por_pasajero    NUMERIC(8,2),          -- precio_total / nro pasajeros
    capacidad_disponible   SMALLINT NOT NULL CHECK (capacidad_disponible >= 0),
    estado                 estado_viaje NOT NULL DEFAULT 'pendiente',
    fecha                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRIP_PASSENGERS  (quien va en cada viaje)
CREATE TABLE trip_passengers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    pasajero_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    estado         estado_pasajero NOT NULL DEFAULT 'solicitado',
    monto_a_pagar  NUMERIC(8,2),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_trip_pasajero UNIQUE (trip_id, pasajero_id)
);

-- PAYMENTS  (transaccion del calculo; la pasarela externa es otra pieza)
CREATE TABLE payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_passenger_id  UUID NOT NULL REFERENCES trip_passengers(id) ON DELETE CASCADE,
    monto              NUMERIC(8,2) NOT NULL CHECK (monto >= 0),
    estado             estado_pago NOT NULL DEFAULT 'pendiente',
    metodo             TEXT,                 -- referencia a pasarela externa (Stripe/MercadoPago...)
    referencia_externa TEXT,                 -- id de transaccion de la pasarela
    fecha              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RIDE_HISTORY  (PREFERENCIA / SEGURIDAD: "ya viaje con esta persona")
--   Se guarda el par ordenado para que Bedrock priorice gente conocida.
CREATE TABLE ride_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    veces_juntos  INTEGER NOT NULL DEFAULT 1 CHECK (veces_juntos > 0),
    ultimo_viaje  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- evitar duplicados y auto-referencias
    CONSTRAINT chk_distintos CHECK (user_a_id <> user_b_id),
    CONSTRAINT uq_par_usuarios UNIQUE (user_a_id, user_b_id)
);

-- Indices utiles para el matching
CREATE INDEX idx_trips_estado        ON trips(estado);
CREATE INDEX idx_trips_conductor     ON trips(conductor_id);
CREATE INDEX idx_trip_pass_trip      ON trip_passengers(trip_id);
CREATE INDEX idx_trip_pass_pasajero  ON trip_passengers(pasajero_id);
CREATE INDEX idx_ride_hist_user_a    ON ride_history(user_a_id);
CREATE INDEX idx_users_tipo          ON users(tipo_usuario);
