#!/usr/bin/env python3
# Uso (en la VM): python3 scripts/demo-viajes-ruta.py && tremp-psql -f /tmp/viajes-ruta.sql
# Necesita los contenedores osrm y tremp-proxy en la red docker `tremp`. Ver README, sección "Demo en vivo".
# Genera viajes demo con ruta real (OSRM) para que aparezcan en "Buscar viaje" de la app.
import datetime, json, subprocess
CAMPUS = ("Anáhuac Mayab", -89.6355, 21.0590)
LUGARES = [("Altabrisa", -89.5835, 21.0215), ("Centro", -89.6237, 20.9670), ("Paseo Montejo", -89.6150, 20.9890),
           ("Galerías", -89.6075, 21.0115), ("Caucel", -89.7000, 20.9980), ("Temozón Norte", -89.6040, 21.0640)]
CONDUCTORES = [("demo4", 11.0), ("demo6", 9.0), ("demo7", 7.0)]
tz = datetime.timezone(datetime.timedelta(hours=-6))
ahora = datetime.datetime.now(tz)
def ruta(a, b):
    url = f"http://osrm:5000/route/v1/driving/{a[1]},{a[2]};{b[1]},{b[2]}?overview=full&geometries=geojson"
    r = json.loads(subprocess.check_output(["docker", "exec", "tremp-proxy", "wget", "-qO-", url]))["routes"][0]
    return r["geometry"], r["distance"], r["duration"]
cache, sql, i = {}, ["BEGIN;"], 0
for dia in (0, 1):
    base = (ahora + datetime.timedelta(days=dia)).replace(hour=6, minute=0, second=0, microsecond=0)
    for k in range(33):  # 06:00 a 22:00 cada 30 min
        salida = base + datetime.timedelta(minutes=30 * k)
        if salida < ahora + datetime.timedelta(minutes=20):
            continue
        lugar = LUGARES[i % len(LUGARES)]
        a, b = (CAMPUS, lugar) if i % 2 == 0 else (lugar, CAMPUS)
        cond, rend = CONDUCTORES[i % 3]
        if (a, b) not in cache:
            cache[(a, b)] = ruta(a, b)
        geom, dist, dur = cache[(a, b)]
        km = round(dist / 1000, 2); gas = round(km / rend * 27.39, 2); pas = round(gas * 0.70, 2)
        g = json.dumps(geom)
        sql.append(f"""INSERT INTO trips (conductor_id, distancia_km, precio_total, precio_por_pasajero, capacidad_disponible, estado,
  fecha, salida_en, asientos_totales, max_desvio_s, origen, destino, ruta, distancia_m, duracion_s)
SELECT id, {km}, {gas}, {pas}, 3, 'pendiente', now(), '{salida.isoformat()}', 3, 600,
  ST_SetSRID(ST_MakePoint({a[1]}, {a[2]}), 4326), ST_SetSRID(ST_MakePoint({b[1]}, {b[2]}), 4326),
  ST_SetSRID(ST_GeomFromGeoJSON('{g}'), 4326), {dist}, {dur}
FROM users WHERE correo = '{cond}@anahuac.mx';""")
        i += 1
sql.append("COMMIT;")
open("/tmp/viajes-ruta.sql", "w").write("\n".join(sql))
print(i, "viajes,", len(cache), "rutas OSRM")
