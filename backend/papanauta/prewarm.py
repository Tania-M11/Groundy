"""
Precalentamiento de cache de Groundy para la demo.

Llama /analizar/punto por cada coordenada de la demo ANTES de presentar, para
que Supabase las sirva al instante y la PAPANAUTA no espere 60s ante los jueces.

Correr en la PC o en la Orange Pi (necesita internet):
    python prewarm.py

La 1a vez cada punto puede tardar (consulta satelital en vivo). La 2a vez debe
decir fuente=cache y ser casi instantaneo.
"""
import time
import httpx

API_URL = "https://api.groundy.site/analizar/punto"

# Coordenadas de la demo. Agrega aqui las que vayas a mostrar ante los jueces.
PUNTOS = [
    ("Ipiales (finca demo)", 0.8281, -77.6422),
    ("Pasto",                1.2136, -77.2811),
    ("Mojave, Nevada",      39.47,  -118.78),
    ("Sahel, Niger",        13.51,    2.11),
    ("Mekong, Vietnam",     10.03,  105.78),
]


def warm(nombre, lat, lon):
    t0 = time.time()
    try:
        r = httpx.post(API_URL, json={"lat": lat, "lon": lon}, timeout=150.0)
        r.raise_for_status()
        meta = r.json().get("meta", {})
        dt = time.time() - t0
        print(f"OK  {nombre:<24} {dt:6.1f}s  fuente={meta.get('fuente', '?')}")
    except Exception as e:
        print(f"ERR {nombre:<24} {str(e)[:70]}")


if __name__ == "__main__":
    print("Precalentando cache de Groundy...\n")
    for nombre, lat, lon in PUNTOS:
        warm(nombre, lat, lon)
    print("\nListo. Vuelve a correrlo: la 2a vez debe decir fuente=cache y ser instantaneo.")
