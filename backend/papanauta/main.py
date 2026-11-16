# main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid

from llm import chat_with_papanauta

app = FastAPI(title="Papanauta API", description="Groundy's Agronomic Assistant")

# Allow CORS so your frontend (running on localhost or groundy.site) can access it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data structure for incoming requests
class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    farm_lat: float
    farm_lon: float
    farm_crop: str | None = "Unknown"

@app.get("/")
def read_root():
    return {"status": "Papanauta is online", "assistant": "PAPANAUTA"}

@app.post("/chat/papanauta")
async def papanauta_endpoint(request: ChatRequest):
    try:
        # Generate a new conversation ID if it's a new chat
        conv_id = request.conversation_id or str(uuid.uuid4())
        
        # Prepare context for the LLM
        context = {
            "lat": request.farm_lat,
            "lon": request.farm_lon,
            "crop": request.farm_crop
        }

        # Call the LLM orchestrator
        answer = await chat_with_papanauta(
            message=request.message,
            context=context,
            conversation_id=conv_id
        )

        # Return the response
        return {
            "assistant": "PAPANAUTA",
            "conversation_id": conv_id,
            "answer": answer,
            "meta": {
                "farm_lat": request.farm_lat,
                "farm_lon": request.farm_lon
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# To run the server, you would use: uvicorn main:app --reload