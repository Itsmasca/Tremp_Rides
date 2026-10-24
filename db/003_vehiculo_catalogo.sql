-- =============================================================================
-- Migración 003: catálogo de vehículos (issue #4, spec 005)
--
-- El rendimiento deja de ser un dato que escribe el conductor: sale de la
-- categoría del coche (sedán 11, SUV 9, camioneta 7 km/L).
--   - Crea vehicle_catalogo (categoria -> rendimiento_km_l).
--   - Agrega vehicles.categoria y migra los coches existentes por rendimiento.
--   - Elimina vehicles.rendimiento_km_l (se lee por JOIN con el catálogo).
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE vehiculo_categoria AS ENUM ('sedan', 'suv', 'camioneta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_catalogo (
    categoria         vehiculo_categoria PRIMARY KEY,
    rendimiento_km_l  NUMERIC(5,2) NOT NULL CHECK (rendimiento_km_l > 0),
    descripcion       TEXT
);

INSERT INTO vehicle_catalogo (categoria, rendimiento_km_l, descripcion) VALUES
    ('sedan',     11.00, 'Sedán'),
    ('suv',        9.00, 'SUV'),
    ('camioneta',  7.00, 'Camioneta')
ON CONFLICT (categoria) DO NOTHING;

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS categoria vehiculo_categoria REFERENCES vehicle_catalogo(categoria);

-- Coches previos: se asigna la categoría más cercana a su rendimiento declarado.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'vehicles' AND column_name = 'rendimiento_km_l') THEN
        UPDATE vehicles
           SET categoria = CASE
                   WHEN rendimiento_km_l >= 10 THEN 'sedan'::vehiculo_categoria
                   WHEN rendimiento_km_l >= 8  THEN 'suv'::vehiculo_categoria
                   ELSE 'camioneta'::vehiculo_categoria
               END
         WHERE categoria IS NULL;
        ALTER TABLE vehicles DROP COLUMN rendimiento_km_l;
    END IF;
END $$;

ALTER TABLE vehicles ALTER COLUMN categoria SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_creado ON users(creado_en, id);
