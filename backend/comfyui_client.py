"""ComfyUI API Client for Flux 2 Dev image generation."""

import json
import uuid
import random
import aiohttp
from typing import Optional, Callable
from pathlib import Path


class ComfyUIClient:
    """Client for interacting with ComfyUI's API."""

    def __init__(self, host: str = "127.0.0.1", port: int = 8188):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        self.ws_url = f"ws://{host}:{port}/ws"
        self.client_id = str(uuid.uuid4())
        self._available_nodes = None

    async def check_connection(self) -> bool:
        """Check if ComfyUI is running and accessible."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/system_stats", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    return resp.status == 200
        except Exception:
            return False

    async def get_available_nodes(self) -> dict:
        """Get list of available node types from ComfyUI."""
        if self._available_nodes is not None:
            return self._available_nodes

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/object_info") as resp:
                    self._available_nodes = await resp.json()
                    return self._available_nodes
        except Exception:
            return {}

    async def has_node(self, node_type: str) -> bool:
        """Check if a specific node type is available."""
        nodes = await self.get_available_nodes()
        return node_type in nodes

    def create_flux2_workflow(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int = 20,
        guidance: float = 3.5,
        seed: Optional[int] = None
    ) -> dict:
        """Create a Flux 2 Dev text-to-image workflow.

        This workflow uses:
        - UNETLoader for the diffusion model
        - CLIPLoader for the Mistral text encoder
        - VAELoader for the VAE
        - ModelSamplingFlux for proper Flux 2 sampling (if available)
        """

        if seed is None:
            seed = random.randint(0, 2**31 - 1)

        # Flux 2 Dev workflow using separate loaders
        workflow = {
            "load_unet": {
                "class_type": "UNETLoader",
                "inputs": {
                    "unet_name": "flux2_dev_fp8mixed.safetensors",
                    "weight_dtype": "fp8_e4m3fn"
                }
            },
            "load_clip": {
                "class_type": "CLIPLoader",
                "inputs": {
                    "clip_name": "mistral_3_small_flux2_fp8.safetensors",
                    "type": "flux2"
                }
            },
            "load_vae": {
                "class_type": "VAELoader",
                "inputs": {
                    "vae_name": "flux2-vae.safetensors"
                }
            },
            "clip_encode": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": prompt,
                    "clip": ["load_clip", 0]
                }
            },
            "clip_encode_negative": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": "",
                    "clip": ["load_clip", 0]
                }
            },
            "empty_latent": {
                "class_type": "EmptySD3LatentImage",
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": 1
                }
            },
            "model_sampling": {
                "class_type": "ModelSamplingFlux",
                "inputs": {
                    "model": ["load_unet", 0],
                    "max_shift": 1.15,
                    "base_shift": 0.5,
                    "width": width,
                    "height": height
                }
            },
            "sampler": {
                "class_type": "KSampler",
                "inputs": {
                    "model": ["model_sampling", 0],
                    "positive": ["clip_encode", 0],
                    "negative": ["clip_encode_negative", 0],
                    "latent_image": ["empty_latent", 0],
                    "seed": seed,
                    "steps": steps,
                    "cfg": guidance,
                    "sampler_name": "euler",
                    "scheduler": "simple",
                    "denoise": 1.0
                }
            },
            "vae_decode": {
                "class_type": "VAEDecode",
                "inputs": {
                    "samples": ["sampler", 0],
                    "vae": ["load_vae", 0]
                }
            },
            "save_image": {
                "class_type": "SaveImage",
                "inputs": {
                    "images": ["vae_decode", 0],
                    "filename_prefix": "flux_gen"
                }
            }
        }

        return workflow

    def create_flux2_workflow_gguf(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int = 20,
        guidance: float = 3.5,
        seed: Optional[int] = None
    ) -> dict:
        """Create a Flux 2 workflow using GGUF quantized model (Apple Silicon compatible)."""

        if seed is None:
            seed = random.randint(0, 2**31 - 1)

        workflow = {
            "load_unet_gguf": {
                "class_type": "UnetLoaderGGUF",
                "inputs": {
                    "unet_name": "flux2-dev-Q5_K_M.gguf"
                }
            },
            "load_clip": {
                "class_type": "CLIPLoader",
                "inputs": {
                    "clip_name": "mistral_3_small_flux2_bf16.safetensors",
                    "type": "flux2"
                }
            },
            "load_vae": {
                "class_type": "VAELoader",
                "inputs": {
                    "vae_name": "flux2-vae.safetensors"
                }
            },
            "clip_encode": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": prompt,
                    "clip": ["load_clip", 0]
                }
            },
            "clip_encode_negative": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": "",
                    "clip": ["load_clip", 0]
                }
            },
            "empty_latent": {
                "class_type": "EmptySD3LatentImage",
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": 1
                }
            },
            "model_sampling": {
                "class_type": "ModelSamplingFlux",
                "inputs": {
                    "model": ["load_unet_gguf", 0],
                    "max_shift": 1.15,
                    "base_shift": 0.5,
                    "width": width,
                    "height": height
                }
            },
            "sampler": {
                "class_type": "KSampler",
                "inputs": {
                    "model": ["model_sampling", 0],
                    "positive": ["clip_encode", 0],
                    "negative": ["clip_encode_negative", 0],
                    "latent_image": ["empty_latent", 0],
                    "seed": seed,
                    "steps": steps,
                    "cfg": guidance,
                    "sampler_name": "euler",
                    "scheduler": "simple",
                    "denoise": 1.0
                }
            },
            "vae_decode": {
                "class_type": "VAEDecode",
                "inputs": {
                    "samples": ["sampler", 0],
                    "vae": ["load_vae", 0]
                }
            },
            "save_image": {
                "class_type": "SaveImage",
                "inputs": {
                    "images": ["vae_decode", 0],
                    "filename_prefix": "flux_gen"
                }
            }
        }

        return workflow

    def create_flux2_workflow_simple(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int = 20,
        guidance: float = 3.5,
        seed: Optional[int] = None
    ) -> dict:
        """Create a simpler Flux 2 workflow without ModelSamplingFlux node."""

        if seed is None:
            seed = random.randint(0, 2**31 - 1)

        workflow = {
            "load_unet": {
                "class_type": "UNETLoader",
                "inputs": {
                    "unet_name": "flux2_dev_fp8mixed.safetensors",
                    "weight_dtype": "fp8_e4m3fn"
                }
            },
            "load_clip": {
                "class_type": "CLIPLoader",
                "inputs": {
                    "clip_name": "mistral_3_small_flux2_fp8.safetensors",
                    "type": "flux2"
                }
            },
            "load_vae": {
                "class_type": "VAELoader",
                "inputs": {
                    "vae_name": "flux2-vae.safetensors"
                }
            },
            "clip_encode": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": prompt,
                    "clip": ["load_clip", 0]
                }
            },
            "clip_encode_negative": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": "",
                    "clip": ["load_clip", 0]
                }
            },
            "empty_latent": {
                "class_type": "EmptySD3LatentImage",
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": 1
                }
            },
            "sampler": {
                "class_type": "KSampler",
                "inputs": {
                    "model": ["load_unet", 0],
                    "positive": ["clip_encode", 0],
                    "negative": ["clip_encode_negative", 0],
                    "latent_image": ["empty_latent", 0],
                    "seed": seed,
                    "steps": steps,
                    "cfg": guidance,
                    "sampler_name": "euler",
                    "scheduler": "simple",
                    "denoise": 1.0
                }
            },
            "vae_decode": {
                "class_type": "VAEDecode",
                "inputs": {
                    "samples": ["sampler", 0],
                    "vae": ["load_vae", 0]
                }
            },
            "save_image": {
                "class_type": "SaveImage",
                "inputs": {
                    "images": ["vae_decode", 0],
                    "filename_prefix": "flux_gen"
                }
            }
        }

        return workflow

    async def queue_prompt(self, workflow: dict) -> str:
        """Queue a workflow for execution and return the prompt_id."""
        payload = {
            "prompt": workflow,
            "client_id": self.client_id
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/prompt",
                json=payload
            ) as resp:
                result = await resp.json()
                if "error" in result:
                    raise Exception(f"ComfyUI error: {result['error']}")
                return result["prompt_id"]

    async def get_history(self, prompt_id: str) -> dict:
        """Get the execution history for a prompt."""
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.base_url}/history/{prompt_id}") as resp:
                return await resp.json()

    async def get_image(self, filename: str, subfolder: str = "", folder_type: str = "output") -> bytes:
        """Get an image from ComfyUI's output folder."""
        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": folder_type
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.base_url}/view", params=params) as resp:
                return await resp.read()

    async def generate_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int = 20,
        guidance: float = 3.5,
        seed: Optional[int] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> tuple[bytes, dict]:
        """
        Generate an image using Flux 2 Dev.

        Returns:
            Tuple of (image_bytes, metadata)
        """
        # Generate seed if not provided
        if seed is None:
            seed = random.randint(0, 2**31 - 1)

        # Check available nodes - prioritize GGUF for Apple Silicon compatibility
        has_gguf_loader = await self.has_node("UnetLoaderGGUF")
        has_flux_sampling = await self.has_node("ModelSamplingFlux")

        workflow = None
        workflow_type = None

        # Priority: GGUF > Standard > Simple
        if has_gguf_loader:
            workflow = self.create_flux2_workflow_gguf(
                prompt=prompt,
                width=width,
                height=height,
                steps=steps,
                guidance=guidance,
                seed=seed
            )
            workflow_type = "gguf"
        elif has_flux_sampling:
            workflow = self.create_flux2_workflow(
                prompt=prompt,
                width=width,
                height=height,
                steps=steps,
                guidance=guidance,
                seed=seed
            )
            workflow_type = "standard"
        else:
            workflow = self.create_flux2_workflow_simple(
                prompt=prompt,
                width=width,
                height=height,
                steps=steps,
                guidance=guidance,
                seed=seed
            )
            workflow_type = "simple"

        try:
            prompt_id = await self.queue_prompt(workflow)
        except Exception as e:
            # If GGUF fails, fallback to standard or simple
            if workflow_type == "gguf" and has_flux_sampling:
                workflow = self.create_flux2_workflow(
                    prompt=prompt,
                    width=width,
                    height=height,
                    steps=steps,
                    guidance=guidance,
                    seed=seed
                )
                try:
                    prompt_id = await self.queue_prompt(workflow)
                except:
                    workflow = self.create_flux2_workflow_simple(
                        prompt=prompt,
                        width=width,
                        height=height,
                        steps=steps,
                        guidance=guidance,
                        seed=seed
                    )
                    prompt_id = await self.queue_prompt(workflow)
            elif workflow_type in ["gguf", "standard"]:
                workflow = self.create_flux2_workflow_simple(
                    prompt=prompt,
                    width=width,
                    height=height,
                    steps=steps,
                    guidance=guidance,
                    seed=seed
                )
                prompt_id = await self.queue_prompt(workflow)
            else:
                raise e

        # Connect to WebSocket to track progress
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(f"{self.ws_url}?clientId={self.client_id}") as ws:
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)

                        if data["type"] == "progress":
                            if progress_callback:
                                progress_callback(
                                    data["data"]["value"],
                                    data["data"]["max"]
                                )

                        elif data["type"] == "executing":
                            if data["data"]["node"] is None:
                                # Execution finished
                                break

                        elif data["type"] == "execution_error":
                            error_msg = data.get("data", {})
                            raise Exception(f"Execution error: {error_msg}")

        # Get the result
        history = await self.get_history(prompt_id)

        if prompt_id not in history:
            raise Exception("Generation failed - no history found")

        outputs = history[prompt_id]["outputs"]

        # Find the SaveImage output
        for node_id, output in outputs.items():
            if "images" in output:
                image_info = output["images"][0]
                image_bytes = await self.get_image(
                    filename=image_info["filename"],
                    subfolder=image_info.get("subfolder", ""),
                    folder_type=image_info["type"]
                )

                metadata = {
                    "prompt": prompt,
                    "width": width,
                    "height": height,
                    "steps": steps,
                    "guidance": guidance,
                    "seed": seed,
                    "filename": image_info["filename"]
                }

                return image_bytes, metadata

        raise Exception("No image found in output")
