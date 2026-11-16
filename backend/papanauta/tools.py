# tools.py

import httpx
from google.genai import types

# API de Groundy que ya tienen desplegada (Orange Pi + Cloudflare).
GROUNDY_API_URL = "https://api.groundy.site/analizar/punto"


async def analyze_farm(lat: float, lon: float) -> dict:
    """Consulta Groundy: clima y aptitud satelital para una coordenada.

    Con la cache precalentada (ver prewarm.py) responde al instante desde
    Supabase; en frio puede tardar porque consulta satelites en vivo.
    """
    payload = {"lat": lat, "lon": lon}
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(GROUNDY_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()

            climate = data.get("climate", {})
            summary = {
                "temperature_mean_c": climate.get("tmean_c"),
                "annual_rain_mm": climate.get("rain_mm_yr"),
                "aridity_index": climate.get("aridity"),   # <1 seco, >1 humedo
                "best_rotation": data.get("best_rotation"),
                "top_crops": [c.get("id") for c in data.get("crops_top", [])[:3]],
                "confidence": data.get("confidence"),
                "data_source": data.get("meta", {}).get("fuente", "unknown"),
            }
            return summary

        except httpx.TimeoutException:
            return {"error": "La consulta satelital tardo demasiado. Sugiere intentar de nuevo en un momento."}
        except httpx.HTTPStatusError as e:
            return {"error": f"Groundy respondio con error {e.response.status_code}."}
        except Exception as e:
            return {"error": f"No se pudo conectar con Groundy: {str(e)}"}


# NOTA: el conocimiento agronomico ahora vive en el SYSTEM_PROMPT para responder
# al instante, sin una segunda llamada al modelo. Se conserva esta funcion por si
# mas adelante quieren exponerla de nuevo como herramienta (o conectar un RAG real).
async def get_agronomic_knowledge(topic: str, crop: str) -> dict:
    crop_lower = crop.lower() if crop else "papa"
    topic_lower = topic.lower() if topic else "general"
    knowledge_base = {
        "papa_nutrientes": "La papa requiere N, P y K; fertilizar segun analisis de suelo. El K mejora la calidad del tuberculo.",
        "papa_rotacion": "Despues de papa: leguminosas (haba, arveja), cereales (trigo, cebada) o pastos, para romper plagas del suelo.",
        "papa_manejo": "Buen aporque, control de polilla guatemalteca y de la gota; rotacion de 3 o mas anos.",
        "general": f"Para {crop_lower}, haz un analisis de suelo para definir nutrientes y manejo.",
    }
    key = f"{crop_lower}_{topic_lower}"
    return {"resultado": knowledge_base.get(key, knowledge_base["general"])}


def get_tools_schema():
    """Solo analyze_farm. El conocimiento agronomico va en el prompt (mas rapido:
    evita una decision de herramienta y una segunda llamada al modelo)."""
    return [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="analyze_farm",
                    description="Obtiene datos reales de clima/satelite y aptitud de cultivos para la finca del agricultor. Usar SOLO si pregunta por el clima, lluvia, humedad o suelo de SU finca.",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "lat": types.Schema(type=types.Type.NUMBER, description="Latitud de la finca"),
                            "lon": types.Schema(type=types.Type.NUMBER, description="Longitud de la finca"),
                        },
                        required=["lat", "lon"],
                    ),
                )
            ]
        )
    ]


async def execute_tool(tool_call, context: dict):
    if tool_call.name == "analyze_farm":
        return await analyze_farm(context.get("lat"), context.get("lon"))
    return {"error": "Unknown tool"}
