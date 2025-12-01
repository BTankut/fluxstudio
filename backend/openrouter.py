"""OpenRouter integration for AI-powered prompt enhancement."""

import httpx
from typing import Optional

SYSTEM_PROMPT = """You are a Flux 2 prompt engineering expert. Your job is to transform simple user descriptions into highly detailed, effective prompts optimized for Flux 2 Dev image generation model.

Flux 2 responds best to:
- Detailed, descriptive language
- Clear subject descriptions with specific attributes
- Lighting and atmosphere details
- Camera/perspective specifications when relevant
- Artistic style references when appropriate
- Quality boosters like "highly detailed", "professional", "8k", "masterpiece"

Rules:
1. ALWAYS output ONLY the enhanced prompt, nothing else
2. Keep the enhanced prompt concise but rich (50-150 words ideal)
3. Preserve the user's core intent
4. Add technical photography/art terms when appropriate
5. Include mood, lighting, and atmosphere details
6. Do NOT include negative prompt elements
7. Write in English only
8. Do NOT use markdown formatting or bullet points
9. Write as one flowing paragraph

Examples:
User: "a cat sitting on a windowsill"
Enhanced: "A majestic tabby cat with striking amber eyes sits gracefully on a weathered wooden windowsill, bathed in warm golden hour sunlight streaming through lace curtains. Soft bokeh background reveals a cozy room interior. Professional pet photography, shallow depth of field, highly detailed fur texture, cinematic lighting, 8k resolution."

User: "futuristic city"
Enhanced: "A breathtaking cyberpunk metropolis at twilight, towering holographic billboards illuminate rain-slicked streets, flying vehicles weave between impossibly tall chrome and glass skyscrapers, neon reflections dance on wet surfaces, atmospheric fog diffuses colorful city lights, hyper-detailed architecture, cinematic wide-angle composition, masterpiece digital art, 8k ultra HD."

User: "portrait of a woman"
Enhanced: "Elegant portrait of a young woman with flowing auburn hair and piercing green eyes, soft studio lighting creates gentle shadows accentuating her delicate features, subtle makeup enhancing natural beauty, wearing a simple silk blouse, creamy blurred background, professional fashion photography, shallow depth of field, highly detailed skin texture, 8k resolution, masterpiece."
"""


async def enhance_prompt(
    user_prompt: str,
    api_key: str,
    model: str = "anthropic/claude-3-haiku",
    base_url: str = "https://openrouter.ai/api/v1"
) -> str:
    """
    Enhance a simple prompt into a detailed Flux 2 optimized prompt.

    Args:
        user_prompt: The user's simple description
        api_key: OpenRouter API key
        model: The model to use for enhancement
        base_url: OpenRouter API base URL

    Returns:
        Enhanced prompt string
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Flux Generator"
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": f"Transform this into a Flux 2 optimized prompt: {user_prompt}"
            }
        ],
        "max_tokens": 500,
        "temperature": 0.7
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=30.0
        )

        if response.status_code != 200:
            raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")

        result = response.json()
        enhanced = result["choices"][0]["message"]["content"].strip()

        # Clean up any potential markdown formatting
        enhanced = enhanced.strip('"\'')

        return enhanced


async def check_api_key(api_key: str) -> bool:
    """Verify if the OpenRouter API key is valid."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/auth/key",
                headers=headers,
                timeout=10.0
            )
            return response.status_code == 200
    except Exception:
        return False


import json
from pathlib import Path

CACHE_FILE = Path(__file__).parent / "models_cache.json"

async def fetch_available_models(api_key: str, force_refresh: bool = False) -> list:
    """Fetch available models from OpenRouter API with caching."""
    
    # Check cache first
    if not force_refresh and CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r") as f:
                cache_data = json.load(f)
                # You might want to check timestamp here if you want auto-expiry
                return cache_data
        except Exception as e:
            print(f"Error reading cache: {e}")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers=headers,
                timeout=15.0
            )

            if response.status_code != 200:
                # If API fails but we have cache, return cache even if force_refresh was True
                if CACHE_FILE.exists():
                    try:
                        with open(CACHE_FILE, "r") as f:
                            return json.load(f)
                    except:
                        pass
                return []

            data = response.json()
            models = []

            for model in data.get("data", []):
                # Filter for text models suitable for prompt enhancement
                model_id = model.get("id", "")

                # Skip image/audio/embedding models
                if any(x in model_id.lower() for x in ["image", "vision", "audio", "embed", "tts", "whisper"]):
                    continue

                models.append({
                    "id": model_id,
                    "name": model.get("name", model_id),
                    "description": model.get("description", ""),
                    "context_length": model.get("context_length", 0),
                    "pricing": model.get("pricing", {})
                })

            # Sort by name
            models.sort(key=lambda x: x["name"])
            
            # Save to cache
            try:
                with open(CACHE_FILE, "w") as f:
                    json.dump(models, f, indent=2)
            except Exception as e:
                print(f"Error saving cache: {e}")
                
            return models

    except Exception as e:
        print(f"Error fetching models: {e}")
        # Fallback to cache on error
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, "r") as f:
                    return json.load(f)
            except:
                pass
        return []
