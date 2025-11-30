/**
 * Flux Studio - Frontend Application
 * AI-powered image generation with Flux models (mflux/MLX)
 */

const API_BASE = 'http://localhost:8000';

// State
const state = {
    isGenerating: false,
    currentResolution: { width: 1024, height: 1024 },
    currentQuality: 'mid',
    enhancedPrompt: null,
    apiKeyConfigured: false,
    currentModel: 'Flux'
};

// DOM Elements - initialized after DOM ready
let elements = {};

function initElements() {
    elements = {
        // Navigation
        navBtns: document.querySelectorAll('.nav-btn'),
        viewCreate: document.getElementById('viewCreate'),
        viewGallery: document.getElementById('viewGallery'),

        // Status
        statusIndicator: document.getElementById('statusIndicator'),

        // Prompt
        promptInput: document.getElementById('promptInput'),
        enhanceToggle: document.getElementById('enhanceToggle'),
        enhanceModel: document.getElementById('enhanceModel'),
        enhancedPreview: document.getElementById('enhancedPreview'),
        enhancedText: document.getElementById('enhancedText'),
        copyEnhanced: document.getElementById('copyEnhanced'),

        // Resolution
        resolutionGrid: document.getElementById('resolutionGrid'),
        resolutionBtns: document.querySelectorAll('.resolution-btn'),

        // Quality
        qualityGrid: document.getElementById('qualityGrid'),
        qualityBtns: document.querySelectorAll('.quality-btn'),

        // Advanced Settings
        stepsSlider: document.getElementById('stepsSlider'),
        stepsValue: document.getElementById('stepsValue'),
        guidanceSlider: document.getElementById('guidanceSlider'),
        guidanceValue: document.getElementById('guidanceValue'),
        seedInput: document.getElementById('seedInput'),
        randomSeed: document.getElementById('randomSeed'),

        // Generate
        generateBtn: document.getElementById('generateBtn'),

        // Output
        outputEmpty: document.getElementById('outputEmpty'),
        outputLoading: document.getElementById('outputLoading'),
        outputResult: document.getElementById('outputResult'),
        loadingText: document.getElementById('loadingText'),
        progressBar: document.getElementById('progressBar'),
        resultImage: document.getElementById('resultImage'),
        resultMeta: document.getElementById('resultMeta'),
        sizeMeta: document.getElementById('sizeMeta'),
        stepsMeta: document.getElementById('stepsMeta'),
        timeMeta: document.getElementById('timeMeta'),
        seedMeta: document.getElementById('seedMeta'),

        // Output Actions
        downloadBtn: document.getElementById('downloadBtn'),
        fullscreenBtn: document.getElementById('fullscreenBtn'),

        // Gallery
        galleryGrid: document.getElementById('galleryGrid'),
        galleryCount: document.getElementById('galleryCount'),
        galleryEmpty: document.getElementById('galleryEmpty'),

        // Modals
        apiKeyModal: document.getElementById('apiKeyModal'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        skipApiKey: document.getElementById('skipApiKey'),
        saveApiKey: document.getElementById('saveApiKey'),
        fullscreenModal: document.getElementById('fullscreenModal'),
        fullscreenImage: document.getElementById('fullscreenImage'),
        fullscreenClose: document.getElementById('fullscreenClose'),

        // Toast
        toastContainer: document.getElementById('toastContainer')
    };
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    initElements();
    setupEventListeners();
    await checkHealth();
    await loadModels();
    setOutputState('empty');

    // Check for stored API key
    const storedKey = localStorage.getItem('openrouter_api_key');
    if (storedKey) {
        state.apiKeyConfigured = true;
    }
}

// Load models from OpenRouter
async function loadModels() {
    try {
        const response = await fetch(`${API_BASE}/models?t=${Date.now()}`);
        if (!response.ok) {
            elements.enhanceModel.innerHTML = '<option value="">API key required</option>';
            return;
        }

        const data = await response.json();
        elements.enhanceModel.innerHTML = '';

        if (data.models && data.models.length > 0) {
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                option.title = model.description || '';
                elements.enhanceModel.appendChild(option);
            });

            // Select first model by default
            if (data.models.length > 0) {
                elements.enhanceModel.value = data.models[0].id;
            }
        } else {
            elements.enhanceModel.innerHTML = '<option value="">No models available</option>';
        }
    } catch (error) {
        console.error('Failed to load models:', error);
        elements.enhanceModel.innerHTML = '<option value="">Failed to load models</option>';
    }
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Resolution buttons - use event delegation
    elements.resolutionGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.resolution-btn');
        if (btn) selectResolution(btn);
    });

    // Quality buttons - use event delegation
    elements.qualityGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.quality-btn');
        if (btn) selectQuality(btn);
    });

    // Sliders
    elements.stepsSlider.addEventListener('input', (e) => {
        elements.stepsValue.textContent = e.target.value;
    });

    elements.guidanceSlider.addEventListener('input', (e) => {
        elements.guidanceValue.textContent = e.target.value;
    });

    // Random seed
    elements.randomSeed.addEventListener('click', () => {
        elements.seedInput.value = Math.floor(Math.random() * 2147483647);
    });

    // Generate button
    elements.generateBtn.addEventListener('click', generateImage);

    // Copy enhanced prompt
    elements.copyEnhanced.addEventListener('click', copyEnhancedPrompt);

    // Download button
    elements.downloadBtn.addEventListener('click', downloadImage);

    // Fullscreen
    elements.fullscreenBtn.addEventListener('click', () => openFullscreen(elements.resultImage.src));
    elements.fullscreenClose.addEventListener('click', closeFullscreen);
    elements.fullscreenModal.addEventListener('click', (e) => {
        if (e.target === elements.fullscreenModal) closeFullscreen();
    });

    // API Key modal
    elements.saveApiKey.addEventListener('click', saveApiKey);
    elements.skipApiKey.addEventListener('click', () => {
        elements.apiKeyModal.classList.remove('visible');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Prompt input - debounced enhancement preview
    let enhanceTimeout;
    elements.promptInput.addEventListener('input', () => {
        clearTimeout(enhanceTimeout);
        if (elements.enhanceToggle.checked && elements.promptInput.value.length > 10) {
            enhanceTimeout = setTimeout(previewEnhancement, 1500);
        }
    });
}

// Navigation
function switchView(view) {
    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    elements.viewCreate.classList.toggle('active', view === 'create');
    elements.viewGallery.classList.toggle('active', view === 'gallery');

    if (view === 'gallery') {
        loadGallery();
    }
}

// Resolution Selection
function selectResolution(btn) {
    document.querySelectorAll('.resolution-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentResolution = {
        width: parseInt(btn.dataset.width),
        height: parseInt(btn.dataset.height)
    };
}

// Quality Selection
function selectQuality(btn) {
    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentQuality = btn.dataset.quality;

    // Update sliders based on quality preset
    const presets = {
        basic: { steps: 2, guidance: 3.0 },
        mid: { steps: 4, guidance: 3.5 },
        high: { steps: 8, guidance: 4.0 }
    };

    const preset = presets[state.currentQuality];
    if (preset) {
        elements.stepsSlider.value = preset.steps;
        elements.stepsValue.textContent = preset.steps;
        elements.guidanceSlider.value = preset.guidance;
        elements.guidanceValue.textContent = preset.guidance;
    }
}

// Health Check
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();

        const statusText = elements.statusIndicator.querySelector('.status-text');

        if (data.mflux || data.comfyui) {
            elements.statusIndicator.className = 'status-indicator connected';
            // Store and display model name
            if (data.model) {
                state.currentModel = data.model;
                statusText.textContent = data.model;
            } else {
                statusText.textContent = 'Connected';
            }
        } else {
            elements.statusIndicator.className = 'status-indicator disconnected';
            statusText.textContent = 'Model offline';
        }

        state.apiKeyConfigured = data.openrouter_configured;

        // Show API key modal if not configured
        if (!state.apiKeyConfigured && !localStorage.getItem('openrouter_api_key')) {
            setTimeout(() => {
                elements.apiKeyModal.classList.add('visible');
            }, 1000);
        }

    } catch (error) {
        elements.statusIndicator.className = 'status-indicator disconnected';
        elements.statusIndicator.querySelector('.status-text').textContent = 'API offline';
    }
}

// Output State Management
function setOutputState(state) {
    elements.outputEmpty.classList.remove('active');
    elements.outputLoading.classList.remove('active');
    elements.outputResult.classList.remove('active');

    switch (state) {
        case 'empty':
            elements.outputEmpty.classList.add('active');
            break;
        case 'loading':
            elements.outputLoading.classList.add('active');
            break;
        case 'result':
            elements.outputResult.classList.add('active');
            break;
    }
}

// Generate Image
async function generateImage() {
    const prompt = elements.promptInput.value.trim();

    if (!prompt) {
        showToast('Please enter a prompt', 'error');
        elements.promptInput.focus();
        return;
    }

    if (state.isGenerating) return;

    state.isGenerating = true;
    elements.generateBtn.classList.add('loading');
    elements.generateBtn.disabled = true;
    setOutputState('loading');
    updateLoadingText('Initializing...');
    updateProgress(0);

    try {
        // Prepare request
        const requestData = {
            prompt: prompt,
            width: state.currentResolution.width,
            height: state.currentResolution.height,
            quality_preset: state.currentQuality,
            enhance_prompt: elements.enhanceToggle.checked,
            enhancement_model: elements.enhanceModel.value
        };

        const seedValue = elements.seedInput.value.trim();
        if (seedValue) {
            requestData.seed = parseInt(seedValue);
        }

        // Show progress stages
        if (requestData.enhance_prompt) {
            updateLoadingText('Enhancing prompt with AI...');
            updateProgress(10);
        }

        // Simulate progress updates
        const progressInterval = setInterval(() => {
            const currentProgress = parseFloat(elements.progressBar.style.width) || 0;
            if (currentProgress < 80) {
                updateProgress(currentProgress + Math.random() * 5);
            }
        }, 500);

        setTimeout(() => updateLoadingText(`Generating with ${state.currentModel}...`), 2000);

        // Make request
        const response = await fetch(`${API_BASE}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        clearInterval(progressInterval);
        updateProgress(100);

        const result = await response.json();

        if (result.success) {
            // Show result
            elements.resultImage.src = `data:image/png;base64,${result.image_base64}`;

            // Update metadata
            elements.sizeMeta.textContent = `${result.metadata.width} × ${result.metadata.height}`;
            elements.stepsMeta.textContent = `${result.metadata.steps} steps`;
            elements.timeMeta.textContent = formatTime(result.metadata.generation_time);
            elements.seedMeta.textContent = `Seed: ${result.metadata.seed}`;

            // Show enhanced prompt if used
            if (result.enhanced_prompt) {
                state.enhancedPrompt = result.enhanced_prompt;
                elements.enhancedText.textContent = result.enhanced_prompt;
                elements.enhancedPreview.classList.add('visible');
            } else {
                elements.enhancedPreview.classList.remove('visible');
            }

            setOutputState('result');
            showToast('Image generated successfully!', 'success');
        } else {
            throw new Error(result.error || 'Generation failed');
        }

    } catch (error) {
        console.error('Generation error:', error);
        setOutputState('empty');
        showToast(error.message || 'Failed to generate image', 'error');
    } finally {
        state.isGenerating = false;
        elements.generateBtn.classList.remove('loading');
        elements.generateBtn.disabled = false;
    }
}

// Preview Enhancement
async function previewEnhancement() {
    if (!state.apiKeyConfigured) return;

    const prompt = elements.promptInput.value.trim();
    if (!prompt || prompt.length < 10) return;

    try {
        const response = await fetch(`${API_BASE}/enhance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                model: elements.enhanceModel.value
            })
        });

        const result = await response.json();

        if (result.success) {
            state.enhancedPrompt = result.enhanced;
            elements.enhancedText.textContent = result.enhanced;
            elements.enhancedPreview.classList.add('visible');
        }
    } catch (error) {
        console.error('Enhancement preview error:', error);
    }
}

// Loading Helpers
function updateLoadingText(text) {
    elements.loadingText.textContent = text;
}

function updateProgress(percent) {
    elements.progressBar.style.width = `${Math.min(100, percent)}%`;
}

// Format generation time
function formatTime(seconds) {
    if (!seconds) return '0s';
    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

// Copy Enhanced Prompt
async function copyEnhancedPrompt() {
    if (state.enhancedPrompt) {
        await navigator.clipboard.writeText(state.enhancedPrompt);
        showToast('Prompt copied to clipboard', 'success');
    }
}

// Download Image
function downloadImage() {
    const link = document.createElement('a');
    link.href = elements.resultImage.src;
    link.download = `flux_${Date.now()}.png`;
    link.click();
    showToast('Image downloaded', 'success');
}

// Fullscreen
function openFullscreen(src) {
    elements.fullscreenImage.src = src;
    elements.fullscreenModal.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
    elements.fullscreenModal.classList.remove('visible');
    document.body.style.overflow = '';
}

// Gallery
async function loadGallery() {
    try {
        const response = await fetch(`${API_BASE}/gallery`);
        const data = await response.json();

        elements.galleryGrid.innerHTML = '';

        if (data.images.length === 0) {
            elements.galleryEmpty.classList.add('visible');
            elements.galleryCount.textContent = '0 images';
            return;
        }

        elements.galleryEmpty.classList.remove('visible');
        elements.galleryCount.textContent = `${data.images.length} images`;

        data.images.forEach(image => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <img src="${API_BASE}${image.url}" alt="Generated image" loading="lazy">
                <div class="gallery-item-overlay">
                    <span class="gallery-item-meta">${image.metadata?.prompt?.slice(0, 50) || 'No prompt'}...</span>
                </div>
                <button type="button" class="gallery-delete-btn" data-filename="${image.filename}" title="Delete image">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                </button>
            `;

            // Click on image opens fullscreen
            const img = item.querySelector('img');
            img.addEventListener('click', () => openFullscreen(`${API_BASE}${image.url}`));

            // Click on delete button
            const deleteBtn = item.querySelector('.gallery-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteGalleryImage(image.filename);
            });

            elements.galleryGrid.appendChild(item);
        });

    } catch (error) {
        console.error('Failed to load gallery:', error);
        showToast('Failed to load gallery', 'error');
    }
}

// Delete Gallery Image
async function deleteGalleryImage(filename) {
    if (!confirm('Delete this image?')) return;

    try {
        const response = await fetch(`${API_BASE}/gallery/${filename}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('Image deleted', 'success');
            loadGallery(); // Refresh gallery
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Failed to delete image:', error);
        showToast('Failed to delete image', 'error');
    }
}

// API Key
async function saveApiKey() {
    const key = elements.apiKeyInput.value.trim();

    if (!key) {
        showToast('Please enter an API key', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ openrouter_api_key: key })
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('openrouter_api_key', key);
            state.apiKeyConfigured = true;
            elements.apiKeyModal.classList.remove('visible');
            showToast('API key saved successfully', 'success');
        } else {
            throw new Error('Invalid API key');
        }
    } catch (error) {
        showToast('Invalid API key', 'error');
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Keyboard Shortcuts
function handleKeyboard(e) {
    // Escape to close modals
    if (e.key === 'Escape') {
        closeFullscreen();
        elements.apiKeyModal.classList.remove('visible');
    }

    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        generateImage();
    }
}

// Periodic health check
setInterval(checkHealth, 30000);
