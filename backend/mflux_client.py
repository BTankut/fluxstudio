"""mflux Client for Flux 1 Schnell image generation on Apple Silicon."""

import io
import random
import asyncio
from pathlib import Path
from typing import Optional, Callable
from concurrent.futures import ThreadPoolExecutor

from mflux.config.config import Config
from mflux.config.model_config import ModelConfig
from mflux.models.flux.variants.txt2img.flux import Flux1


class MFluxClient:
    """Client for generating images with mflux (native Apple Silicon MLX)."""

    def __init__(self, model: str = "schnell", quantize: Optional[int] = 4):
        """
        Initialize mflux client.

        Args:
            model: Model variant - "schnell" (fast) or "dev" (quality)
            quantize: Quantization level (4, 5, 6, 8) for memory efficiency. None for full precision.
        """
        self.model_name = model
        self.quantize = quantize
        self._model = None
        self._executor = ThreadPoolExecutor(max_workers=1)

    async def check_connection(self) -> bool:
        """Check if mflux is available (always true for local execution)."""
        return True

    def _load_model(self):
        """Load the model if not already loaded."""
        if self._model is None:
            self._model = Flux1(
                model_config=ModelConfig.from_name(model_name=self.model_name),
                quantize=self.quantize,
            )
        return self._model

    def _generate_sync(
        self,
        prompt: str,
        width: int,
        height: int,
        steps: int,
        guidance: float,
        seed: int,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> tuple[bytes, dict]:
        """Synchronous image generation (runs in thread pool)."""
        model = self._load_model()

        # Configure generation
        config = Config(
            num_inference_steps=steps,
            height=height,
            width=width,
            guidance=guidance,
        )

        # Generate the image
        image = model.generate_image(
            seed=seed,
            prompt=prompt,
            config=config,
        )

        # Convert PIL image to bytes
        img_byte_arr = io.BytesIO()
        image.image.save(img_byte_arr, format='PNG')
        image_bytes = img_byte_arr.getvalue()

        metadata = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "steps": steps,
            "guidance": guidance,
            "seed": seed,
            "model": f"flux-1-{self.model_name}",
            "quantize": self.quantize
        }

        return image_bytes, metadata

    async def generate_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int = 4,
        guidance: float = 3.5,
        seed: Optional[int] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> tuple[bytes, dict]:
        """
        Generate an image using Flux 1 Schnell.

        Args:
            prompt: Text prompt for image generation
            width: Image width (default 1024)
            height: Image height (default 1024)
            steps: Number of inference steps (default 4 for schnell, 20 for dev)
            guidance: Guidance scale (default 3.5)
            seed: Random seed (optional)
            progress_callback: Optional callback for progress updates

        Returns:
            Tuple of (image_bytes, metadata)
        """
        if seed is None:
            seed = random.randint(0, 2**31 - 1)

        # Run generation in thread pool to not block async loop
        loop = asyncio.get_event_loop()
        image_bytes, metadata = await loop.run_in_executor(
            self._executor,
            self._generate_sync,
            prompt, width, height, steps, guidance, seed, progress_callback
        )

        return image_bytes, metadata
