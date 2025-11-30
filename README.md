# Flux Studio

A modern web application for AI-powered image generation using Flux models on Apple Silicon, with intelligent prompt enhancement via OpenRouter.

## Features

- **Local Image Generation**: Uses mflux for Flux 1 Schnell model on Apple Silicon (MLX)
- **AI Prompt Enhancement**: Automatically enhances prompts using 300+ AI models from OpenRouter
- **Quality Presets**: Basic (2 steps), Standard (4 steps), High (8 steps)
- **Multiple Resolutions**: Square, Landscape, Portrait, Cinematic, Classic, Photo
- **Gallery**: View, download, and manage generated images
- **Real-time Progress**: Visual feedback during generation
- **Dark Theme**: Modern, elegant dark UI

## Tech Stack

### Backend
- **FastAPI** - High-performance async API
- **mflux** - MLX-based Flux model for Apple Silicon
- **OpenRouter API** - Access to 300+ AI models for prompt enhancement

### Frontend
- **Vanilla JS** - No framework dependencies
- **CSS Variables** - Themeable design system
- **Responsive** - Works on desktop and tablet

## Requirements

- macOS with Apple Silicon (M1/M2/M3)
- Python 3.10+
- OpenRouter API key (optional, for prompt enhancement)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/BTankut/fluxstudio.git
cd fluxstudio
```

### 2. Setup Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Set Environment Variables

```bash
export OPENROUTER_API_KEY="your-api-key-here"
export MFLUX_MODEL="schnell"  # or "dev" for higher quality
export MFLUX_QUANTIZE="4"     # 4, 5, 6, or 8 bit quantization
```

### 4. Start the Backend

```bash
cd backend
source .venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 5. Start the Frontend

```bash
cd frontend
python -m http.server 3000
```

### 6. Open in Browser

Navigate to `http://localhost:3000`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and status |
| `/config` | GET | Get current configuration |
| `/config` | POST | Update configuration (API key) |
| `/models` | GET | Fetch available models from OpenRouter |
| `/enhance` | POST | Enhance a prompt using AI |
| `/generate` | POST | Generate an image |
| `/gallery` | GET | List generated images |
| `/gallery/{filename}` | DELETE | Delete an image |
| `/outputs/{filename}` | GET | Serve generated images |

## Configuration

### Quality Presets

| Preset | Steps | Guidance | Use Case |
|--------|-------|----------|----------|
| Basic | 2 | 3.0 | Fast previews |
| Standard | 4 | 3.5 | Balanced quality |
| High | 8 | 4.0 | Best quality |

### Resolution Presets

| Name | Dimensions | Aspect Ratio |
|------|------------|--------------|
| Square | 1024×1024 | 1:1 |
| Landscape | 1344×768 | 16:9 |
| Portrait | 768×1344 | 9:16 |
| Cinematic | 1536×640 | 21:9 |
| Classic | 1152×896 | 4:3 |
| Photo | 1216×832 | 3:2 |

## Project Structure

```
fluxstudio/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── mflux_client.py   # mflux integration
│   ├── openrouter.py     # OpenRouter API client
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── index.html        # Main HTML
│   ├── app.js            # Application logic
│   └── styles.css        # Styling
├── outputs/              # Generated images
└── README.md
```

## License

MIT License

## Author

Built by [BTankut](https://github.com/BTankut)
