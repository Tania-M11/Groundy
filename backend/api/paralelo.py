"""Motor en paralelo (B1) y parcela que reutiliza el punto (B2).

point_engine hace sus consultas una tras otra: NASA POWER, la altura SRTM y seis series de 25 años en
Google Earth Engine (NDVI, EVI, temperatura, dos de humedad SMAP e IMERG). Cada getInfo() espera al anterior,
y por eso un punto nuevo tarda ~100 s. Aqui se lanzan todas a la vez, reutilizando las MISMAS funciones del
motor (point_engine no se modifica), y se arma el resultado exactamente igual que pe.analizar_punto.

B2: la parcela ya no recalcula el punto por su cuenta. Recibe una funcion `punto_fn` (en main.py, la que pasa
por la cache y su candado), y la pide en el centroide que usa la web (promedio de vertices, como Turf). Asi la
consulta de punto que la web hace en paralelo y la de parcela comparten un solo calculo.

POWER: una parcela descargaba NASA POWER hasta 3 veces (el punto y las rotaciones de punto y de parcela).
`power_point` guarda la descarga unas horas en memoria y la comparte; rotaciones.py tambien la usa.

Si point_engine cambia su forma de armar el resultado, hay que reflejarlo en `_armar_punto`
(tests/test_paralelo.py compara ambos y avisa si se separan).
"""
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import ee
import point_engine as pe
import rotation_score as rs

# Earth Engine admite decenas de peticiones simultaneas por cuenta; 8 cubre un punto completo.
HILOS = 8


def _en_paralelo(tareas):
    """{nombre: funcion} -> {nombre: resultado}. Si una tarea falla, su excepcion se propaga al leerla."""
    with ThreadPoolExecutor(max_workers=min(HILOS, len(tareas))) as ex:
        futuros = {k: ex.submit(f) for k, f in tareas.items()}
        return {k: f.result() for k, f in futuros.items()}


# ---- NASA POWER compartido -------------------------------------------------
POWER_TTL_S = 6 * 3600   # el clima diario historico no cambia en horas
POWER_MAX = 64           # lugares recordados (cada uno ~1 MB)
_power = {}              # (lat, lon) a 4 decimales -> (instante, DataFrame)
_power_locks = {}
_power_guard = threading.Lock()


def power_point(lat, lon):
    """pe.power_point con memoria: el mismo lugar se descarga una sola vez, aunque lo pidan varios a la vez."""
    k = (round(float(lat), 4), round(float(lon), 4))
    with _power_guard:
        lock = _power_locks.setdefault(k, threading.Lock())
    with lock:
        hit = _power.get(k)
        if hit and time.time() - hit[0] < POWER_TTL_S:
            return hit[1].copy()
        pw = pe.power_point(lat, lon)
        with _power_guard:
            _power[k] = (time.time(), pw)
            while len(_power) > POWER_MAX:  # se olvida el mas antiguo
                _power.pop(min(_power, key=lambda x: _power[x][0]))
        return pw.copy()


def _smap_mensual(lat, lon, start="2020-01-01", end="2025-12-31"):
    """Humedad SMAP (superficie y raiz) en UNA consulta: Earth Engine promedia cada mes en el servidor y solo
    devuelve 12 valores por banda. Mismas imagenes (1 por dia, 13 h), misma proyeccion nativa y escala 11 km que
    pe._smap_clim, asi que da los mismos valores (verificado en la Orange Pi: diferencia 0) en ~21 s en vez de
    ~56 s: pe._smap_clim trae las ~2.000 imagenes una por una y lo hace dos veces, una por banda."""
    pt = ee.Geometry.Point([lon, lat])
    c = (ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").select(["sm_surface", "sm_rootzone"])
         .filterDate(start, end).filter(ee.Filter.calendarRange(13, 13, "hour")))
    proj = ee.Image(c.first()).select("sm_surface").projection()
    meses = [ee.Feature(None, c.filter(ee.Filter.calendarRange(m, m, "month")).mean().setDefaultProjection(proj)
                        .reduceRegion(ee.Reducer.first(), pt, 11000)).set("moy", m) for m in range(1, 13)]
    surf, root = [None] * 12, [None] * 12
    for f in ee.FeatureCollection(meses).getInfo()["features"]:
        p = f["properties"]
        m = int(p["moy"]) - 1
        if p.get("sm_surface") is not None:
            surf[m] = round(float(p["sm_surface"]), 4)
        if p.get("sm_rootzone") is not None:
            root[m] = round(float(p["sm_rootzone"]), 4)
    return surf, root


# Climatologia SMAP precalculada (misma coleccion, periodo, filtro de 13 h y cuadricula nativa que
# _smap_mensual), guardada una vez como imagen de 24 bandas en el proyecto de Earth Engine. Leer un pixel tarda
# <1 s en vez de promediar 2.191 imagenes (~21 s). Si no existe o falla, se calcula en vivo como antes.
SMAP_ASSET = os.environ.get("SMAP_ASSET", "projects/kinetic-anvil-457906-e8/assets/groundy_smap_clim_2020_2025")


# Cuadricula nativa de SMAP L4 en Earth Engine (la del asset) y la de 11 km que usa el calculo en vivo
# (= ee.Projection("EPSG:4326", SMAP_NATIVO).atScale(11000), consultado a Earth Engine el 19 nov 2026).
SMAP_NATIVO = [0.09516256938937351, 0, -180, 0, -0.09516149300142858, 85.0445018795655]
SMAP_11KM = [0.0988152401064585, 0, -180, 0, -0.09881412240299685, 85.0445018795655]


def _centro_11km(lat, lon):
    """Centro de la celda de 11 km que contiene el punto. El calculo en vivo toma el pixel nativo que cae en ese
    centro (vecino mas cercano); leer el asset a 11 km directamente promediaria 4 pixeles y daria otro valor."""
    a, _, x0, _, e, y0 = SMAP_11KM
    i, j = math.floor((lon - x0) / a), math.floor((lat - y0) / e)
    return y0 + (j + 0.5) * e, x0 + (i + 0.5) * a


def _smap_precalculado(lat, lon):
    """Lee los 12 meses x 2 bandas del asset en el mismo pixel que usa _smap_mensual (verificado en la Orange Pi
    con 12 lugares del mundo: valores identicos; ~1 s)."""
    clat, clon = _centro_11km(lat, lon)
    d = (ee.Image(SMAP_ASSET).reduceRegion(ee.Reducer.first(), ee.Geometry.Point([clon, clat]),
                                           crs="EPSG:4326", crsTransform=SMAP_NATIVO).getInfo())
    surf = [None if d.get("sm_surface_%02d" % m) is None else round(float(d["sm_surface_%02d" % m]), 4) for m in range(1, 13)]
    root = [None if d.get("sm_rootzone_%02d" % m) is None else round(float(d["sm_rootzone_%02d" % m]), 4) for m in range(1, 13)]
    return surf, root


def _smap(lat, lon):
    """Primero el asset precalculado; si no esta disponible, el calculo en vivo (mismos valores)."""
    if SMAP_ASSET:
        try:
            return _smap_precalculado(lat, lon)
        except Exception:
            pass
    return _smap_mensual(lat, lon)


def _capas_smap(lat, lon):
    """Las dos capas SMAP con el mismo estado que pe._layer ('ok' / 'sin_datos' / 'error')."""
    try:
        surf, root = _smap(lat, lon)
    except Exception as ex:
        return {k: {"status": "error", "reason": repr(ex)[:90], "values": [None] * 12} for k in ("sm_surf", "sm_root")}
    return {"sm_surf": pe._layer(lambda: surf), "sm_root": pe._layer(lambda: root)}


# Orden de las capas igual que pe.gee_point
CAPAS = ("ndvi", "evi", "lst_c", "sm_surf", "sm_root", "rain_imerg")


def _capas_gee(lat, lon):
    """Las capas de pe.gee_point como tareas independientes (cada una atrapa sus errores).
    La tarea "smap" devuelve las dos capas de humedad juntas."""
    return {
        "ndvi": lambda: pe._layer(lambda: pe._modis_clim("MODIS/061/MOD13Q1", "NDVI", 250, lat, lon, "2001-01-01", "2025-12-31", 0.0001)),
        "evi": lambda: pe._layer(lambda: pe._modis_clim("MODIS/061/MOD13Q1", "EVI", 250, lat, lon, "2001-01-01", "2025-12-31", 0.0001)),
        "lst_c": lambda: pe._layer(lambda: pe._modis_clim("MODIS/061/MOD11A2", "LST_Day_1km", 1000, lat, lon, "2001-01-01", "2025-12-31", 0.02, -273.15)),
        "smap": lambda: _capas_smap(lat, lon),
        "rain_imerg": lambda: pe._layer(lambda: pe._imerg_clim(lat, lon)),
    }


def _armar_punto(lat, lon, crops, pw, elev, veg):
    """Mismo calculo y misma forma de salida que pe.analizar_punto, con los datos ya descargados."""
    elev = 0.0 if elev is None else elev
    clim = rs.monthly_from_power(pw, lat, elev)
    summ = rs.crop_table(clim, crops, pw)
    tab, notes = rs.compare_strategies(summ, crops)
    flag = pe._confidence(pw, lat, elev)
    best = tab.index[0]
    rain_yr = pe._annual_mean(clim["rain"])
    et0_yr = pe._annual_mean(clim["et0"])
    _im = veg.get("rain_imerg", {}).get("values", [None] * 12)
    imerg_yr = round(sum(x for x in _im if x is not None)) if any(x is not None for x in _im) else None
    _sources = [v for v in [round(rain_yr), imerg_yr] if v is not None]
    return {
        "lat": lat, "lon": lon, "elev_m": round(elev),
        "climate": {"tmean_c": round(float(clim["tmean"].mean()), 1),
                    "rain_mm_yr": round(rain_yr),
                    "et0_mm_yr": round(et0_yr),
                    "aridity": round(rain_yr / max(et0_yr, 1), 2),
                    "rain_imerg_mm_yr": imerg_yr,
                    "rain_range_mm": [min(_sources), max(_sources)] if len(_sources) > 1 else None},
        "vegetation_monthly": {k: v["values"] for k, v in veg.items()},
        "vegetation_status": {k: v["status"] for k, v in veg.items()},
        "confidence": flag.get("confidence"),
        "sister_site": flag.get("sister_site"),
        "potato": {k: (round(float(v), 2) if isinstance(v, float) else v)
                   for k, v in summ.loc["papa"].items() if k in ["suit", "reliability", "limiting", "best_month_es"]},
        "crops_top": [{"id": i, "suit": round(float(r.suit), 2), "best_month": r.best_month_es, "limits": r.limiting}
                      for i, r in summ.head(6).iterrows()],
        "rotations": [{"name": k, "score": round(float(r["score"]), 1), "seq": rs.STRATEGIES[k],
                       "notes": notes[k]} for k, r in tab.iterrows()],
        "best_rotation": best,
        "provenance": {"climate": "NASA POWER (grid 0.5x0.625)", "ndvi_evi": "MODIS MOD13Q1 250m",
                       "lst": "MODIS MOD11A2 1km", "soil_moisture": "SMAP L4 ~9km", "elevation": "SRTM 30m",
                       "note": "caracterizacion ambiental del punto, no medicion directa de la parcela"},
    }


def analizar_punto(lat, lon, crops=None):
    """B1: POWER, altura y las seis capas de GEE a la vez. Mismo resultado que pe.analizar_punto."""
    crops = crops if crops is not None else rs.load_crops()
    tareas = {"pw": lambda: power_point(lat, lon), "elev": lambda: pe.elev_point(lat, lon)}
    tareas.update(_capas_gee(lat, lon))
    r = _en_paralelo(tareas)
    r.update(r.pop("smap"))                # sm_surf y sm_root
    veg = {k: r[k] for k in CAPAS}         # mismo orden de claves que pe.gee_point
    return _armar_punto(lat, lon, crops, r["pw"], r["elev"], veg)


def centro_web(coords):
    """Centroide como lo calcula la web (Turf: promedio de vertices sin repetir el primero), a 5 decimales."""
    ring = list(coords)
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    lon = sum(float(c[0]) for c in ring) / len(ring)
    lat = sum(float(c[1]) for c in ring) / len(ring)
    return round(lat, 5), round(lon, 5)


def analizar_area(coords, crops=None, punto_fn=None):
    """B1 + B2: terreno, vegetacion y punto a la vez; el punto llega por `punto_fn` (cache) si se da."""
    geom = pe._polygon(coords)
    plat, plon = centro_web(coords)
    punto_fn = punto_fn or (lambda la, lo: analizar_punto(la, lo, crops=crops))
    dem = ee.Image("USGS/SRTMGL1_003")
    slope = ee.Terrain.slope(dem).rename("slope")
    ndvi_img = (ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI")
                .filterDate("2022-01-01", "2025-12-31").mean().multiply(0.0001).rename("NDVI"))
    r = _en_paralelo({
        "centroide": lambda: geom.centroid(1).coordinates().getInfo(),
        "area": lambda: geom.area(1).getInfo(),
        "elev": lambda: pe._zonal(dem, "elevation", geom, 30),
        "pend": lambda: pe._zonal(slope, "slope", geom, 30),
        "ndvi_modis": lambda: pe._zonal(ndvi_img, "NDVI", geom, 250),
        "ndvi_s2": lambda: pe._s2_ndvi_zonal(geom),
        "punto": lambda: punto_fn(plat, plon),
    })
    lon, lat = float(r["centroide"][0]), float(r["centroide"][1])
    punto = r["punto"]
    return {
        "centroide": {"lat": round(lat, 5), "lon": round(lon, 5)},
        "area_ha": round(r["area"] / 10000.0, 2),
        "terreno_dentro_de_la_finca": {"elevacion_m": r["elev"], "pendiente_grados": r["pend"]},
        "vegetacion": {"ndvi_modis_250m": r["ndvi_modis"], "ndvi_sentinel2_10m": r["ndvi_s2"]},
        "clima_regional": punto["climate"],
        "humedad_suelo_regional_mensual": punto["vegetation_monthly"].get("sm_root"),
        "aptitud": punto["potato"],
        "mejor_rotacion": punto["best_rotation"],
        "rotaciones": punto["rotations"],
        "confianza": punto["confidence"],
        "resolucion": {"relieve_pendiente": "SRTM 30m — varia dentro de la finca",
                       "ndvi": "MODIS 250m — variacion gruesa (Sentinel-2 10m para detalle fino, fase 2)",
                       "humedad_suelo": "SMAP ~9km — valor regional",
                       "clima": "NASA POWER ~50km — valor regional"},
    }
