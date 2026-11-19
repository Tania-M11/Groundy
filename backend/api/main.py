"""
Groundy — API (motor Camino B)
Una sola puerta HTTP sobre el motor point_engine. La app Groundy y el equipo
consultan aqui; GEE, NASA POWER y Supabase quedan detras.

Correr (desde la raiz del proyecto):
    set GEE_KEY_PATH=secrets/gee_key.json        (Windows)
    set SUPABASE_URL=...                          (opcional, activa cache)
    set SUPABASE_SERVICE_KEY=...                  (opcional, activa cache)
    uvicorn api.main:app --reload --port 8000
Docs automaticas: http://localhost:8000/docs
"""
import os
import sys
from datetime import datetime, timezone

# El motor vive en src/ e importa climate_tools / rotation_score por nombre.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "src"))
os.chdir(_ROOT)  # rutas relativas del motor (data/crop_requirements.csv)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import point_engine as pe          # NO se modifica
import rotation_score as rs        # NO se modifica

from . import config, cache, rotaciones, paralelo  # paralelo: motor en paralelo (B1) y parcela que reutiliza el punto (B2)

app = FastAPI(
    title="Groundy API",
    version="1.1",
    description="Groundy: analisis ambiental y de rotacion de cultivos para cualquier punto o finca del planeta. Equipo Potatonauts.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Estado global ---------------------------------------------------------
CROPS = rs.load_crops()
GEE_OK = False
GEE_ERROR = None


@app.on_event("startup")
def _startup():
    """Inicializa Google Earth Engine una sola vez, con la llave del entorno."""
    global GEE_OK, GEE_ERROR
    try:
        pe.init_ee(config.GEE_KEY_PATH)
        GEE_OK = True
    except Exception as e:
        GEE_OK = False
        GEE_ERROR = str(e)


def _necesita_gee():
    if not GEE_OK:
        raise HTTPException(
            status_code=503,
            detail="Google Earth Engine no esta inicializado. "
                   "Verifique GEE_KEY_PATH. Detalle: %s" % (GEE_ERROR or "sin llave"),
        )


# ---- meta y validez --------------------------------------------------------
def _meta(fuente, cache_key, generado_en, vigencia_hasta):
    """Bloque meta al nivel superior. Distingue cuando se GENERO el resultado
    (generado_en) de cuando se ENTREGA esta respuesta (entregado_en)."""
    return {
        "plataforma": "Groundy",
        "fuente": fuente,                       # "cache" | "vivo"
        "proc_version": config.PROC_VERSION,
        "cache_key": cache_key,
        "generado_en": generado_en,             # calculo original del resultado
        "vigencia_hasta": vigencia_hasta,       # expires_at (None si no se cacheo)
        "entregado_en": datetime.now(timezone.utc).isoformat(),
    }


def _valido_punto(p):
    if not isinstance(p, dict) or "climate" not in p:
        return False
    vs = p.get("vegetation_status") or {}
    if vs and all(v == "error" for v in vs.values()):
        return False
    return True


def _valido_area(p):
    if not isinstance(p, dict):
        return False
    elev = (p.get("terreno_dentro_de_la_finca") or {}).get("elevacion_m") or {}
    return elev.get("media") is not None


# ---- Modelos de entrada ----------------------------------------------------
class PuntoIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitud en grados")
    lon: float = Field(..., ge=-180, le=180, description="Longitud en grados")


class AreaIn(BaseModel):
    coords: list[list[float]] = Field(
        ..., min_length=3,
        description="Vertices del poligono de la finca como [[lon,lat], ...] (minimo 3)",
    )


# ---- Endpoints -------------------------------------------------------------
@app.get("/salud", tags=["sistema"])
def salud():
    """Ping. Estado del API, de GEE y de la cache."""
    return {"estado": "ok", "gee": GEE_OK, "cultivos": int(len(CROPS)),
            "cache": config.CACHE_ENABLED, "proc_version": config.PROC_VERSION}


@app.get("/cultivos", tags=["datos"])
def cultivos():
    """Lista de cultivos disponibles (para llenar menus del demo)."""
    out = []
    for cid, r in CROPS.iterrows():
        out.append({"id": cid, "name_es": r["name_es"], "role": r["role"],
                    "family": r["family"], "is_legume": bool(r["is_legume"])})
    return {"total": len(out), "cultivos": out}


def _punto_cacheado(lat, lon):
    """Punto con cache y candado por clave. Lo usan /analizar/punto y /analizar/area (B2): si la web pide el punto
    y la parcela a la vez, el segundo espera al primero y recibe su resultado en vez de recalcularlo."""
    key = cache.build_key("punto", lat=lat, lon=lon)
    with cache.key_lock(key):
        row = cache.get(key)
        if row is not None:                         # HIT vigente
            payload = row["payload"]
            payload["meta"] = _meta("cache", key, row.get("created_at"), row.get("expires_at"))
            return payload
        payload = paralelo.analizar_punto(lat, lon, crops=CROPS)   # MISS -> motor en vivo (B1: en paralelo)
        try:  # rotaciones globales a la medida del sitio (reemplazan las andinas fijas)
            _rots, _best = rotaciones.para_sitio(lat, lon, payload.get("elev_m"), CROPS)
            if _rots:
                payload["rotations"], payload["best_rotation"] = _rots, _best
        except Exception:
            pass
        if _valido_punto(payload):
            d = config.CACHE_COORD_DECIMALS
            params = {"kind": "punto", "lat": round(lat, d), "lon": round(lon, d),
                      "data": config.DATA_SIGNATURE}
            generado, vigencia = cache.put(key, "punto", payload, lat=lat, lon=lon,
                                           params=params, source="GEE(MODIS/SMAP/S2)+POWER+SRTM")
        else:                                       # invalido: no se cachea
            generado, vigencia = datetime.now(timezone.utc).isoformat(), None
        payload["meta"] = _meta("vivo", key, generado, vigencia)
        return payload


@app.post("/analizar/punto", tags=["analisis"])
def analizar_punto(body: PuntoIn):
    """Caracteriza un PUNTO: clima, vegetacion, aptitud, rotaciones, confianza."""
    _necesita_gee()
    try:
        return _punto_cacheado(body.lat, body.lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error analizando el punto: %s" % e)


@app.post("/analizar/area", tags=["analisis"])
def analizar_area(body: AreaIn):
    """Caracteriza una FINCA (poligono): variacion de terreno/NDVI + clima regional."""
    _necesita_gee()
    key = cache.build_key("area", coords=body.coords)
    with cache.key_lock(key):
        row = cache.get(key)
        if row is not None:
            payload = row["payload"]
            payload["meta"] = _meta("cache", key, row.get("created_at"), row.get("expires_at"))
            return payload
        try:
            payload = paralelo.analizar_area(body.coords, crops=CROPS, punto_fn=_punto_cacheado)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error analizando el area: %s" % e)
        try:  # rotaciones globales a la medida del sitio
            # mismo centro que el punto (el de la web): asi reutiliza su descarga de NASA POWER
            _clat, _clon = paralelo.centro_web(body.coords)
            _elev = ((payload.get("terreno_dentro_de_la_finca") or {}).get("elevacion_m") or {}).get("media")
            _rots, _best = rotaciones.para_sitio(_clat, _clon, _elev, CROPS)
            if _rots:
                payload["rotaciones"], payload["mejor_rotacion"] = _rots, _best
        except Exception:
            pass
        if _valido_area(payload):
            d = config.CACHE_COORD_DECIMALS
            clat = round(sum(c[1] for c in body.coords) / len(body.coords), d)
            clon = round(sum(c[0] for c in body.coords) / len(body.coords), d)
            params = {"kind": "area", "coords": [[round(x, d), round(y, d)] for x, y in body.coords],
                      "data": config.DATA_SIGNATURE}
            generado, vigencia = cache.put(key, "area", payload, lat=clat, lon=clon,
                                           params=params, source="GEE(SRTM/MODIS/S2)+POWER+SMAP")
        else:
            generado, vigencia = datetime.now(timezone.utc).isoformat(), None
        payload["meta"] = _meta("vivo", key, generado, vigencia)
        return payload
