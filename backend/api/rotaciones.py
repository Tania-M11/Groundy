"""
Groundy — rotaciones GLOBALES construidas con los datos reales de cada lugar.

No modifica el motor: reutiliza sus funciones publicas
(point_engine.power_point, rotation_score.monthly_from_power / crop_table /
_components) para armar rotaciones a la medida de CUALQUIER punto del planeta,
en vez de las 5 rotaciones andinas fijas.

Regla: toma los cultivos mas aptos del sitio, arma secuencias de 3 anos, y las
puntua con la misma logica del motor (clima, confiabilidad, rotacion de
familia, leguminosa, diversidad). Si algo falla, el llamador conserva las
rotaciones originales del motor.
"""
from itertools import combinations, permutations

import rotation_score as rs

from . import paralelo  # NASA POWER compartido con el punto (no se descarga otra vez)

# Mismos pesos que usa el motor para comparar rotaciones.
WEIGHTS = {"climate": 0.40, "reliability": 0.20, "family_break": 0.20,
           "legume": 0.10, "diversity": 0.10}


def _tabla_suit(lat, lon, elev, crops):
    """Tabla de aptitud de los 42 cultivos para el sitio (via funciones del motor)."""
    pw = paralelo.power_point(lat, lon)
    clim = rs.monthly_from_power(pw, lat, elev)
    return rs.crop_table(clim, crops, pw)


def _score(seq, summ, crops):
    c = rs._components(seq, summ, crops)
    return round(100.0 * sum(c[k] * WEIGHTS[k] for k in WEIGHTS), 1), c


def _notes(seq, summ, crops, comp):
    notes = []
    fams = [crops.loc[c, "family"] for c in seq]
    if comp["family_break"] >= 0.999:
        notes.append("No repite familia botanica en anos consecutivos: corta ciclos de plagas y enfermedades")
    else:
        rep = next((fams[i] for i in range(len(fams)) if fams[i] == fams[(i + 1) % len(fams)]), fams[0])
        notes.append("Repite la familia %s en anos consecutivos: mas presion de plagas y enfermedades del suelo (FAO recomienda rotar 3 o mas anos)" % rep)
    notes.append("Incluye una leguminosa (fija nitrogeno)" if comp["legume"] >= 1
                 else "Sin leguminosa: depende mas de fertilizacion nitrogenada")
    lo = min(seq, key=lambda c: float(summ.loc[c, "suit"]))
    notes.append("Cultivo limitante: %s (aptitud %.2f, limita %s)" %
                 (crops.loc[lo, "name_es"], float(summ.loc[lo, "suit"]), summ.loc[lo, "limiting"]))
    notes.append("No evalua suelo (pH, textura, drenaje), plagas locales, mercado ni riego")
    return notes


def construir(summ, crops, top_k=8, n_rot=5, min_suit=0.12):
    """Arma las mejores rotaciones de 3 anos con los cultivos aptos del sitio."""
    orden = [c for c in summ.index if float(summ.loc[c, "suit"]) >= min_suit]
    cand = list(orden[:top_k])
    # garantizar que exista al menos una leguminosa entre los candidatos
    if not any(bool(crops.loc[c, "is_legume"]) for c in cand):
        leg = next((c for c in orden if bool(crops.loc[c, "is_legume"])), None)
        if leg and leg not in cand:
            cand.append(leg)
    if len(cand) < 3:
        return None, None
    mejores = {}
    for combo in combinations(cand, 3):
        best = None
        for perm in permutations(combo):
            sc, comp = _score(list(perm), summ, crops)
            if best is None or sc > best[0]:
                best = (sc, list(perm), comp)
        mejores[frozenset(combo)] = best
    tops = sorted(mejores.values(), key=lambda x: x[0], reverse=True)[:n_rot]
    rot = []
    for sc, seq, comp in tops:
        rot.append({"seq": seq,
                    "name": " - ".join(crops.loc[c, "name_es"] for c in seq),
                    "score": sc,
                    "notes": _notes(seq, summ, crops, comp)})
    return rot, rot[0]["name"]


def para_sitio(lat, lon, elev, crops):
    """Rotaciones globales para un punto/centroide. Devuelve (lista, mejor) o (None, None)."""
    summ = _tabla_suit(lat, lon, elev or 0, crops)
    return construir(summ, crops)
