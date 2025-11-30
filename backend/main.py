"""
Flux Generator Backend API

A FastAPI server that uses mflux for Flux 1 Schnell image generation
on Apple Silicon (MLX) with OpenRouter for AI-powered prompt enhancement.
"""

import os
import json
import base64
import asyncio
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from mflux_client import MFluxClient
from openrouter import enhance_prompt, check_api_key, fetch_available_models


# Configuration
MFLUX_MODEL = os.getenv("MFLUX_MODEL", "schnell")  # schnell (fast) or dev (quality)
MFLUX_QUANTIZE = int(os.getenv("MFLUX_QUANTIZE", "4"))  # 4, 5, 6, 8 bit quantization
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


app = FastAPI(
    title="Flux Generator API",
    description="AI-powered image generation with Flux 1 Schnell (mflux/MLX)",
    version="2.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mflux client (lazy initialization to avoid slow startup)
mflux_client = None

def get_mflux_client():
    """Get or create the mflux client (lazy loading)."""
    global mflux_client
    if mflux_client is None:
        mflux_client = MFluxClient(model=MFLUX_MODEL, quantize=MFLUX_QUANTIZE)
    return mflux_client

# WebSocket connections for progress updates
active_connections: dict[str, WebSocket] = {}


# Quality Presets - controls steps and guidance independent of resolution
QUALITY_PRESETS = {
    "basic": {
        "name": "Basic",
        "description": "Fast generation, good for previews",
        "steps": 2,
        "guidance": 3.0
    },
    "mid": {
        "name": "Standard",
        "description": "Balanced quality and speed",
        "steps": 4,
        "guidance": 3.5
    },
    "high": {
        "name": "High Quality",
        "description": "Best quality, slower generation",
        "steps": 8,
        "guidance": 4.0
    }
}


# Request/Response Models
class GenerateRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    steps: Optional[int] = None  # If None, use quality preset
    guidance: Optional[float] = None  # If None, use quality preset
    quality_preset: str = "mid"  # basic, mid, high
    seed: Optional[int] = None
    enhance_prompt: bool = True
    enhancement_model: str = "anthropic/claude-3-haiku"


class EnhanceRequest(BaseModel):
    prompt: str
    model: str = "anthropic/claude-3-haiku"


class ConfigRequest(BaseModel):
    openrouter_api_key: Optional[str] = None


class GenerateResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    original_prompt: str
    enhanced_prompt: Optional[str] = None
    metadata: dict
    error: Optional[str] = None


# API Endpoints
@app.get("/")
async def root():
    return {"status": "Flux Generator API is running"}


@app.get("/health")
async def health_check():
    """Check if all services are available."""
    return {
        "api": True,
        "mflux": True,  # mflux runs locally, always available
        "model": f"flux-1-{MFLUX_MODEL}",
        "quantize": MFLUX_QUANTIZE,
        "openrouter_configured": bool(OPENROUTER_API_KEY),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/config")
async def get_config():
    """Get current configuration status."""
    return {
        "model": f"flux-1-{MFLUX_MODEL}",
        "quantize": MFLUX_QUANTIZE,
        "openrouter_configured": bool(OPENROUTER_API_KEY),
        "resolution_presets": get_resolution_presets(),
        "quality_presets": QUALITY_PRESETS
    }


@app.get("/models")
async def get_models():
    """Fetch available models from OpenRouter."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=400, detail="OpenRouter API key not configured")

    models = await fetch_available_models(OPENROUTER_API_KEY)
    return {"models": models}


@app.post("/config")
async def update_config(config: ConfigRequest):
    """Update configuration."""
    global OPENROUTER_API_KEY

    if config.openrouter_api_key:
        # Validate the key
        if await check_api_key(config.openrouter_api_key):
            OPENROUTER_API_KEY = config.openrouter_api_key
            return {"success": True, "message": "API key updated"}
        else:
            raise HTTPException(status_code=400, detail="Invalid API key")

    return {"success": True}


@app.post("/enhance")
async def enhance_prompt_endpoint(request: EnhanceRequest):
    """Enhance a prompt using AI."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=400, detail="OpenRouter API key not configured")

    try:
        enhanced = await enhance_prompt(
            user_prompt=request.prompt,
            api_key=OPENROUTER_API_KEY,
            model=request.model
        )
        return {
            "success": True,
            "original": request.prompt,
            "enhanced": enhanced
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate", response_model=GenerateResponse)
async def generate_image(request: GenerateRequest):
    """Generate an image using Flux 1 Schnell (mflux/MLX)."""

    final_prompt = request.prompt
    enhanced_prompt = None

    # Get quality preset values
    preset = QUALITY_PRESETS.get(request.quality_preset, QUALITY_PRESETS["mid"])

    # Use preset values if not explicitly provided
    steps = request.steps if request.steps is not None else preset["steps"]
    guidance = request.guidance if request.guidance is not None else preset["guidance"]

    # Enhance prompt if requested
    if request.enhance_prompt and OPENROUTER_API_KEY:
        try:
            enhanced_prompt = await enhance_prompt(
                user_prompt=request.prompt,
                api_key=OPENROUTER_API_KEY,
                model=request.enhancement_model
            )
            final_prompt = enhanced_prompt
        except Exception as e:
            # Continue with original prompt if enhancement fails
            print(f"Prompt enhancement failed: {e}")

    try:
        # Get or create mflux client
        client = get_mflux_client()

        # Generate the image with timing
        start_time = time.time()
        image_bytes, metadata = await client.generate_image(
            prompt=final_prompt,
            width=request.width,
            height=request.height,
            steps=steps,
            guidance=guidance,
            seed=request.seed
        )
        generation_time = round(time.time() - start_time, 2)

        # Save image locally
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"flux_{timestamp}.png"
        filepath = OUTPUT_DIR / filename

        with open(filepath, "wb") as f:
            f.write(image_bytes)

        # Save metadata
        metadata_file = OUTPUT_DIR / f"flux_{timestamp}.json"
        full_metadata = {
            **metadata,
            "original_prompt": request.prompt,
            "enhanced_prompt": enhanced_prompt,
            "timestamp": timestamp,
            "generation_time": generation_time,
            "quality_preset": request.quality_preset
        }
        with open(metadata_file, "w") as f:
            json.dump(full_metadata, f, indent=2)

        # Encode image to base64
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        return GenerateResponse(
            success=True,
            image_url=f"/outputs/{filename}",
            image_base64=image_base64,
            original_prompt=request.prompt,
            enhanced_prompt=enhanced_prompt,
            metadata=full_metadata
        )

    except Exception as e:
        return GenerateResponse(
            success=False,
            original_prompt=request.prompt,
            enhanced_prompt=enhanced_prompt,
            metadata={},
            error=str(e)
        )


@app.get("/outputs/{filename}")
async def get_output(filename: str):
    """Serve generated images."""
    filepath = OUTPUT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)


@app.get("/gallery")
async def get_gallery():
    """Get list of generated images."""
    images = []
    for file in sorted(OUTPUT_DIR.glob("*.png"), reverse=True):
        metadata_file = file.with_suffix(".json")
        metadata = {}
        if metadata_file.exists():
            with open(metadata_file) as f:
                metadata = json.load(f)

        images.append({
            "filename": file.name,
            "url": f"/outputs/{file.name}",
            "created": file.stat().st_mtime,
            "metadata": metadata
        })

    return {"images": images[:50]}  # Return last 50 images


@app.delete("/gallery/{filename}")
async def delete_image(filename: str):
    """Delete a generated image."""
    filepath = OUTPUT_DIR / filename
    if filepath.exists():
        filepath.unlink()
        # Also delete metadata
        metadata_file = filepath.with_suffix(".json")
        if metadata_file.exists():
            metadata_file.unlink()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Image not found")


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket for real-time progress updates."""
    await websocket.accept()
    active_connections[client_id] = websocket

    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        del active_connections[client_id]


def get_resolution_presets():
    """Get available resolution presets."""
    return [
        {"name": "Square (1:1)", "width": 1024, "height": 1024, "icon": "square"},
        {"name": "Landscape (16:9)", "width": 1344, "height": 768, "icon": "landscape"},
        {"name": "Portrait (9:16)", "width": 768, "height": 1344, "icon": "portrait"},
        {"name": "Wide (21:9)", "width": 1536, "height": 640, "icon": "wide"},
        {"name": "Classic (4:3)", "width": 1152, "height": 896, "icon": "classic"},
        {"name": "Photo (3:2)", "width": 1216, "height": 832, "icon": "photo"},
    ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
