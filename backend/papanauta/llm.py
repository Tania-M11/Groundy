# llm.py

import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

from tools import get_tools_schema, execute_tool
from prompts import SYSTEM_PROMPT

load_dotenv()

# --- API KEY ROTATION CONFIGURATION ---
raw_keys = os.getenv("GEMINI_API_KEYS", "")
if raw_keys:
    KEYS_LIST = [k.strip() for k in raw_keys.split(",") if k.strip()]
else:
    single = os.getenv("GEMINI_API_KEY")
    KEYS_LIST = [single] if single else []

if not KEYS_LIST:
    raise ValueError("No GEMINI_API_KEYS or GEMINI_API_KEY found in .env")

# Create a client for each key
CLIENTS = [genai.Client(api_key=key) for key in KEYS_LIST]

MODEL_ID = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
CHAT_HISTORY = {}

def _thinking_config():
    if MODEL_ID.startswith("gemini-3") or MODEL_ID.startswith("gemini-4"):
        return types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
    return types.ThinkingConfig(thinking_budget=0)

async def _call_with_rotation(history, config):
    """Tries the call with each client until one succeeds."""
    last_error = None
    for i, client in enumerate(CLIENTS):
        try:
            print(f"-> Trying with key #{i+1}...")
            response = await client.aio.models.generate_content(
                model=MODEL_ID, contents=history, config=config
            )
            print(f"   ✓ Success with key #{i+1}")
            return response
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            if "quota" in err_str or "429" in err_str or "resource_exhausted" in err_str:
                print(f"   ✗ Key #{i+1} exhausted, trying next...")
                continue
            else:
                raise e
    raise last_error

def _fallback_response(message: str, context: dict) -> str:
    """Generates a natural, professional response if all APIs fail."""
    msg = message.lower()
    crop = context.get("crop", "your crop")
    
    # Natural, confident responses (no mention of local memory or system limits)
    if any(p in msg for p in ["hi", "hello", "hey", "good morning", "good afternoon"]):
        return (f"Hello! I'm Papanauta 🥔. I'm ready to help you manage {crop}. "
                f"What would you like to review today?")
    
    elif any(p in msg for p in ["weather", "rain", "temperature", "humidity", "climate"]):
        return (f"For your location, I recommend keeping a close eye on soil moisture for {crop}. "
                f"Regional conditions can vary, so checking your plot's moisture directly is always a good practice. "
                f"If rainfall has been scarce, consider supplementary irrigation to avoid stress.")
    
    elif any(p in msg for p in ["nutrient", "fertilizer", "npk", "urea", "compost"]):
        return (f"For {crop}, the key nutrients are Nitrogen (N), Phosphorus (P), and Potassium (K). "
                f"I strongly recommend conducting a soil test before applying fertilizers, as the exact doses "
                f"depend on your soil's current nutrient levels and the crop's growth stage. "
                f"This will help you optimize inputs and avoid waste.")
    
    elif any(p in msg for p in ["rotation", "plant", "sowing", "seed", "what crop"]):
        return (f"A solid rotation strategy for {crop} is to alternate with legumes (such as beans or peas) "
                f"to fix nitrogen in the soil, or with grasses to improve structure. "
                f"Avoiding the same crop in consecutive cycles helps break pest and disease cycles.")
    
    elif any(p in msg for p in ["pest", "disease", "fungus", "insect", "moth", "bug"]):
        return (f"For pest management in {crop}, I recommend implementing constant monitoring, "
                f"removing crop residues after harvest, and applying crop rotation as a preventive measure. "
                f"If you notice specific symptoms, consulting a local agronomist for a precise diagnosis is the best next step.")
    
    else:
        return (f"I can help you with climate data, soil conditions, nutrient management, and rotation strategies "
                f"for {crop}. Could you specify which aspect you'd like to explore?")

async def chat_with_papanauta(message: str, context: dict, conversation_id: str) -> str:
    if conversation_id not in CHAT_HISTORY:
        CHAT_HISTORY[conversation_id] = []
    history = CHAT_HISTORY[conversation_id]

    formatted_prompt = SYSTEM_PROMPT.format(
        lat=context["lat"], lon=context["lon"],
        crop=context.get("crop", "Not specified"),
    )

    config = types.GenerateContentConfig(
        system_instruction=formatted_prompt,
        tools=get_tools_schema(),
        temperature=0.1,
        thinking_config=_thinking_config(),
    )

    start_len = len(history)
    history.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

    try:
        # First call (with rotation)
        response = await _call_with_rotation(history, config)

        if response.function_calls:
            history.append(response.candidates[0].content)
            for tool_call in response.function_calls:
                print(f"-> PAPANAUTA is calling tool: {tool_call.name}")
                tool_result = await execute_tool(tool_call, context)
                history.append(types.Content(
                    role="user",
                    parts=[types.Part.from_function_response(
                        name=tool_call.name, response=tool_result,
                    )],
                ))
            # Second call (with rotation)
            response = await _call_with_rotation(history, config)

        final_text = response.text
        history.append(response.candidates[0].content)
        return final_text

    except Exception as e:
        del history[start_len:]
        err_str = str(e).lower()
        
        # If it's a quota error, activate the natural fallback responses
        if "quota" in err_str or "429" in err_str or "resource_exhausted" in err_str:
            print("⚠️ All keys exhausted. Activating seamless fallback responses.")
            return _fallback_response(message, context)
            
        # If it's another non-quota error, raise it for debugging
        raise