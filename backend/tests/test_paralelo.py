"""Prueba del motor en paralelo (B1) y de la parcela que reutiliza el punto (B2), sin llave de Earth Engine.

Earth Engine se simula: cada consulta devuelve datos fijos tras una demora proporcional a la real (escala 1:10;
un punto real tarda ~100 s). NASA POWER es real (se descarga una vez). Verifica:
  1. paralelo.analizar_punto da EXACTAMENTE lo mismo que point_engine.analizar_punto, y mas rapido.
  2. paralelo.analizar_area da lo mismo que point_engine.analizar_area, y mas rapido.
  3. Con la API: si la web pide punto y parcela a la vez, el punto se calcula UNA sola vez (antes, dos)
     y NASA POWER se descarga una sola vez (antes, hasta tres: punto + rotaciones del punto y de la parcela).

Correr desde backend/:  python tests/test_paralelo.py
"""
import json
import os
import sys
import threading
import time
from unittest import mock

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "src"))
sys.path.insert(0, RAIZ)
sys.modules["ee"] = mock.MagicMock()  # Earth Engine simulado (sin llave)

import point_engine as pe  # noqa: E402

ESCALA = 0.1  # 1 s real -> 0,1 s en la prueba
# Demoras medidas en la Orange Pi (19 nov 2026): solo SMAP en vivo es lenta (35-56 s por banda); el resto tarda 0,4-4 s
DEMORA = {"power": 2.4, "elev": 0.6, "modis": 3, "smap": 45, "imerg": 1.5, "zonal": 0.6, "s2": 1.3}
LAT, LON = 0.86, -77.62
COORDS = [[-77.6208, 0.8592], [-77.6192, 0.8591], [-77.6191, 0.8608], [-77.6208, 0.8608]]

llamadas = {"power": 0}
_candado = threading.Lock()
_pw_real = pe.power_point(LAT, LON)  # NASA POWER real, una sola vez


def _espera(k):
    time.sleep(DEMORA[k] * ESCALA)


def f_power(lat, lon, *a, **k):
    with _candado:
        llamadas["power"] += 1
    _espera("power")
    return _pw_real.copy()


def f_elev(lat, lon):
    # La altura del punto solo la pide el calculo del punto: cuenta cuantas veces se calcula.
    with _candado:
        llamadas["punto"] = llamadas.get("punto", 0) + 1
    _espera("elev")
    return 2950.0


def f_modis(coll, band, scale, lat, lon, start, end, factor, offset=0.0):
    _espera("modis")
    base = {"NDVI": 0.6, "EVI": 0.4, "LST_Day_1km": 18.0}[band]
    return [round(base + m * 0.01, 4) for m in range(12)]


def f_smap(band, scale, lat, lon, *a, **k):
    _espera("smap")
    return [round(0.30 + m * 0.005, 4) for m in range(12)]


def f_smap_mensual(lat, lon, *a, **k):
    # paralelo._smap_mensual: las dos bandas en una sola consulta (en la Pi tarda ~21 s frente a ~56 s)
    time.sleep(21 * ESCALA)
    v = [round(0.30 + m * 0.005, 4) for m in range(12)]
    return list(v), list(v)


def f_smap_precalculado(lat, lon):
    # paralelo._smap_precalculado: lee un pixel del asset SMAP (~1 s); mismos valores que el calculo en vivo
    time.sleep(1 * ESCALA)
    v = [round(0.30 + m * 0.005, 4) for m in range(12)]
    return list(v), list(v)


def f_imerg(lat, lon, *a, **k):
    _espera("imerg")
    return [round(80 + 10 * m, 1) for m in range(12)]


def f_zonal(img, band, geom, scale):
    _espera("zonal")
    return {"media": 3000.0 if scale == 30 else 0.55, "desv": 4.0, "min": 2990.0, "max": 3010.0}


def f_s2(geom, *a, **k):
    _espera("s2")
    return {"media": 0.61, "desv": 0.05, "min": 0.4, "max": 0.8}


class Geom:
    """Poligono simulado: centroide = promedio de vertices (lo mismo que usa la web) y area fija."""
    def __init__(self, coords):
        ring = coords[:-1] if coords[0] == coords[-1] else coords
        self.c = [round(sum(p[0] for p in ring) / len(ring), 5), round(sum(p[1] for p in ring) / len(ring), 5)]

    def centroid(self, *_):
        g = self
        return mock.Mock(coordinates=lambda: mock.Mock(getInfo=lambda: (time.sleep(1 * ESCALA), g.c)[1]))

    def area(self, *_):
        return mock.Mock(getInfo=lambda: (time.sleep(1 * ESCALA), 33200.0)[1])


PARCHES = [
    mock.patch.object(pe, "power_point", f_power),
    mock.patch.object(pe, "elev_point", f_elev),
    mock.patch.object(pe, "_modis_clim", f_modis),
    mock.patch.object(pe, "_smap_clim", f_smap),
    mock.patch.object(pe, "_imerg_clim", f_imerg),
    mock.patch.object(pe, "_zonal", f_zonal),
    mock.patch.object(pe, "_s2_ndvi_zonal", f_s2),
    mock.patch.object(pe, "_polygon", lambda coords: Geom(coords)),
]


def igual(a, b):
    return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)


def cronometrar(f):
    t = time.time()
    r = f()
    return r, time.time() - t


def main():
    for p in PARCHES:
        p.start()
    from api import paralelo
    mock.patch.object(paralelo, "_smap_mensual", f_smap_mensual).start()
    import rotation_score as rs
    crops = rs.load_crops()
    ok = True

    # 0. SMAP: si el asset precalculado falla, se calcula en vivo y da lo mismo
    def _falla(lat, lon):
        raise RuntimeError("asset no disponible")
    with mock.patch.object(paralelo, "_smap_precalculado", _falla):
        vivo = paralelo._capas_smap(LAT, LON)
    with mock.patch.object(paralelo, "_smap_precalculado", f_smap_precalculado):
        pre = paralelo._capas_smap(LAT, LON)
    mismo = igual(vivo, pre) and vivo["sm_root"]["status"] == "ok"
    ok &= mismo
    print(f"0. SMAP: plan B en vivo si falla el precalculado, mismos valores: {mismo}")
    mock.patch.object(paralelo, "_smap_precalculado", f_smap_precalculado).start()

    # 1. Punto
    antes, t_antes = cronometrar(lambda: pe.analizar_punto(LAT, LON, crops=crops))
    paralelo._power.clear()
    ahora, t_ahora = cronometrar(lambda: paralelo.analizar_punto(LAT, LON, crops=crops))
    mismo = igual(antes, ahora)
    ok &= mismo
    print(f"1. Punto:   antes {t_antes / ESCALA:5.0f} s  ->  ahora {t_ahora / ESCALA:5.0f} s   resultado identico: {mismo}")

    # 2. Parcela (sin cache): el centroide simulado es el de la web, asi que el resultado debe coincidir
    antes, t_antes = cronometrar(lambda: pe.analizar_area(COORDS, crops=crops))
    paralelo._power.clear()
    ahora, t_ahora = cronometrar(lambda: paralelo.analizar_area(COORDS, crops=crops))
    mismo = igual(antes, ahora)
    ok &= mismo
    print(f"2. Parcela: antes {t_antes / ESCALA:5.0f} s  ->  ahora {t_ahora / ESCALA:5.0f} s   resultado identico: {mismo}")

    # 3. API: la web pide punto (centroide) y parcela a la vez; cache en memoria en lugar de Supabase.
    #    "antes" reproduce el codigo original: punto en serie y parcela que recalcula el punto por su cuenta.
    from fastapi.testclient import TestClient
    from api import cache, main as api
    original = {
        "analizar_punto": lambda lat, lon, crops=None: pe.analizar_punto(lat, lon, crops=crops),
        "analizar_area": lambda coords, crops=None, punto_fn=None: pe.analizar_area(coords, crops=crops),
        "power_point": lambda lat, lon: pe.power_point(lat, lon),  # sin memoria, como antes
    }
    plat, plon = paralelo.centro_web(COORDS)
    for etiqueta, cambios in (("antes", original), ("ahora", {})):
        memoria = {}
        paralelo._power.clear()
        guardar = lambda k, kind, payload, **kw: (memoria.__setitem__(k, {"payload": json.loads(json.dumps(payload, default=str)), "created_at": "t", "expires_at": "t"}), ("t", "t"))[1]  # noqa: E731
        extra = [mock.patch.object(paralelo, k, v) for k, v in cambios.items()]
        with mock.patch.object(cache, "get", lambda k: memoria.get(k)), mock.patch.object(cache, "put", guardar):
            [e.start() for e in extra]
            with TestClient(api.app) as cli:
                llamadas["punto"] = llamadas["power"] = 0
                res = {}
                hilos = [
                    threading.Thread(target=lambda: res.__setitem__("punto", cli.post("/analizar/punto", json={"lat": plat, "lon": plon}))),
                    threading.Thread(target=lambda: res.__setitem__("area", cli.post("/analizar/area", json={"coords": COORDS}))),
                ]
                t = time.time()
                [h.start() for h in hilos]
                [h.join() for h in hilos]
                t_total = time.time() - t
            [e.stop() for e in extra]
        codigos = (res["punto"].status_code, res["area"].status_code)
        print(f"3. Web pide punto + parcela a la vez ({etiqueta}): {t_total / ESCALA:5.0f} s, respuestas {codigos}, "
              f"veces que se calculo el punto: {llamadas['punto']}, descargas de NASA POWER: {llamadas['power']}")
        if etiqueta == "ahora":
            mismo_clima = res["area"].json()["clima_regional"] == res["punto"].json()["climate"]
            ok &= llamadas["punto"] == 1 and llamadas["power"] == 1 and codigos == (200, 200) and mismo_clima
            print(f"   La parcela usa el mismo clima que el punto: {mismo_clima}")

    print("\nRESULTADO:", "TODO OK" if ok else "HAY DIFERENCIAS")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
