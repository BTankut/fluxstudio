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
        settingsBtn: document.getElementById('settingsBtn'),

        // Status
        statusIndicator: document.getElementById('statusIndicator'),

        // Prompt
        promptInput: document.getElementById('promptInput'),
        enhanceBtn: document.getElementById('enhanceBtn'),

        // Custom Dropdown Elements
        modelSelect: document.getElementById('modelSelect'),
        modelTrigger: document.getElementById('modelTrigger'),
        modelOptions: document.getElementById('modelOptions'),
        modelSearch: document.getElementById('modelSearch'),
        selectedModelText: document.querySelector('.selected-model'),
        refreshModelsBtn: document.getElementById('refreshModelsBtn'),

        // enhancedPreview: document.getElementById('enhancedPreview'),
        // enhancedText: document.getElementById('enhancedText'),
        // copyEnhanced: document.getElementById('copyEnhanced'),

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
        currentKeyDisplay: document.getElementById('currentKeyDisplay'),
        keyLastChars: document.getElementById('keyLastChars'),
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
async function loadModels(refresh = false) {
    try {
        if (refresh) {
            elements.refreshModelsBtn.classList.add('loading');
        } else {
            elements.selectedModelText.textContent = 'Loading models...';
        }

        const response = await fetch(`${API_BASE}/models?refresh=${refresh}`);

        if (refresh) {
            elements.refreshModelsBtn.classList.remove('loading');
        }

        if (!response.ok) {
            elements.selectedModelText.textContent = 'API key required';
            return;
        }

        const data = await response.json();
        state.availableModels = data.models || [];

        renderModelOptions(state.availableModels);

        if (state.availableModels.length > 0) {
            // Select first model if none selected
            if (!state.currentEnhanceModel) {
                selectModel(state.availableModels[0]);
            }
        } else {
            elements.selectedModelText.textContent = 'No models available';
        }
    } catch (error) {
        console.error('Failed to load models:', error);
        elements.selectedModelText.textContent = 'Failed to load models';
        if (refresh) elements.refreshModelsBtn.classList.remove('loading');
    }
}

function renderModelOptions(models) {
    elements.modelOptions.innerHTML = '';

    if (models.length === 0) {
        elements.modelOptions.innerHTML = '<div class="select-option">No models found</div>';
        return;
    }

    models.forEach(model => {
        const div = document.createElement('div');
        div.className = 'select-option';
        if (state.currentEnhanceModel && state.currentEnhanceModel.id === model.id) {
            div.classList.add('selected');
        }
        div.textContent = model.name;
        div.dataset.id = model.id;
        div.title = model.description || '';

        div.addEventListener('click', () => {
            selectModel(model);
            elements.modelSelect.querySelector('.select-dropdown').classList.remove('active');
        });

        elements.modelOptions.appendChild(div);
    });
}

function selectModel(model) {
    state.currentEnhanceModel = model;
    elements.selectedModelText.textContent = model.name;

    // Update UI selection
    const options = elements.modelOptions.querySelectorAll('.select-option');
    options.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.id === model.id);
    });
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    elements.navBtns.forEach(btn => {
        if (btn.dataset.view) {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        }
    });

    // Settings button
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => {
            updateKeyDisplay();
            elements.apiKeyModal.classList.add('visible');
            elements.apiKeyInput.focus();
        });
    }

    // Custom Dropdown
    document.addEventListener('click', (e) => {
        if (!elements.modelSelect.contains(e.target)) {
            elements.modelSelect.querySelector('.select-dropdown').classList.remove('active');
        }
    });

    elements.modelTrigger.addEventListener('click', () => {
        elements.modelSelect.querySelector('.select-dropdown').classList.toggle('active');
        if (elements.modelSelect.querySelector('.select-dropdown').classList.contains('active')) {
            elements.modelSearch.focus();
        }
    });

    elements.modelSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.availableModels.filter(m =>
            m.name.toLowerCase().includes(term) ||
            m.id.toLowerCase().includes(term)
        );
        renderModelOptions(filtered);
    });

    elements.refreshModelsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadModels(true);
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
    // if (elements.copyEnhanced) {
    //     elements.copyEnhanced.addEventListener('click', copyEnhancedPrompt);
    // }

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

    // Prompt input - auto-resize
    elements.promptInput.addEventListener('input', () => {
        elements.promptInput.style.height = 'auto';
        elements.promptInput.style.height = elements.promptInput.scrollHeight + 'px';
    });

    // Enhance Button
    if (elements.enhanceBtn) {
        elements.enhanceBtn.addEventListener('click', enhancePrompt);
    }
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

        // Restore API key if backend forgot it but we have it
        if (!state.apiKeyConfigured) {
            const storedKey = localStorage.getItem('openrouter_api_key');
            if (storedKey) {
                // Silently restore key
                fetch(`${API_BASE}/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ openrouter_api_key: storedKey })
                }).then(async (res) => {
                    if (res.ok) {
                        state.apiKeyConfigured = true;
                        // Reload models after restoring key
                        loadModels();
                    }
                });
            } else {
                // Show API key modal if not configured and not in storage
                setTimeout(() => {
                    elements.apiKeyModal.classList.add('visible');
                }, 1000);
            }
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
            enhance_prompt: false, // Manual enhancement only
            enhancement_model: state.currentEnhanceModel ? state.currentEnhanceModel.id : ""
        };

        const seedValue = elements.seedInput.value.trim();
        if (seedValue) {
            requestData.seed = parseInt(seedValue);
        }

        // Show progress stages
        // if (requestData.enhance_prompt) {
        //     updateLoadingText('Enhancing prompt with AI...');
        //     updateProgress(10);
        // }

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

// Enhance Prompt (Manual)
async function enhancePrompt() {
    if (!state.apiKeyConfigured) {
        showToast('Please configure API key first', 'error');
        elements.apiKeyModal.classList.add('visible');
        return;
    }

    const prompt = elements.promptInput.value.trim();
    if (!prompt || prompt.length < 3) {
        showToast('Please enter a prompt to enhance', 'error');
        elements.promptInput.focus();
        return;
    }

    if (elements.enhanceBtn.classList.contains('loading')) return;

    elements.enhanceBtn.classList.add('loading');
    const originalText = elements.enhanceBtn.innerHTML;
    elements.enhanceBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg> Enhancing...`;

    try {
        const response = await fetch(`${API_BASE}/enhance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                model: state.currentEnhanceModel ? state.currentEnhanceModel.id : ""
            })
        });

        const result = await response.json();

        if (result.success) {
            // Update input with enhanced prompt
            elements.promptInput.value = result.enhanced;
            // Trigger input event to resize if needed
            elements.promptInput.dispatchEvent(new Event('input'));

            showToast('Prompt enhanced successfully!', 'success');

            // Highlight effect
            elements.promptInput.style.transition = 'background-color 0.3s';
            const originalBg = elements.promptInput.style.backgroundColor;
            elements.promptInput.style.backgroundColor = 'rgba(212, 168, 83, 0.1)';
            setTimeout(() => {
                elements.promptInput.style.backgroundColor = originalBg;
            }, 500);
        } else {
            throw new Error(result.error || 'Enhancement failed');
        }
    } catch (error) {
        console.error('Enhancement error:', error);
        showToast('Failed to enhance prompt', 'error');
    } finally {
        elements.enhanceBtn.classList.remove('loading');
        elements.enhanceBtn.innerHTML = originalText;
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
async function downloadImage() {
    if (!elements.resultImage.src) return;

    try {
        // Fetch the image as a blob
        const response = await fetch(elements.resultImage.src);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();

        // Use File System Access API if available (modern browsers)
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `flux_${Date.now()}.png`,
                    types: [{
                        description: 'PNG Image',
                        accept: { 'image/png': ['.png'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                showToast('Image saved successfully', 'success');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return; // User cancelled
                // Fallback to classic download if picker fails but wasn't cancelled
                console.warn('File picker failed, falling back to classic download', err);
            }
        }

        // Classic download fallback (creates a blob URL)
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = `flux_${Date.now()}.png`;
        // link.target = '_blank'; // Removed to prevent opening in new tab
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        }, 100);

        showToast('Image downloaded', 'success');
    } catch (e) {
        console.error('Download error:', e);
        showToast('Download failed', 'error');
    }
}

// Save Image Helper
async function saveImage(blob, filename) {
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'PNG Image',
                    accept: { 'image/png': ['.png'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            showToast('Image saved successfully', 'success');
        } else {
            // Fallback
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
            showToast('Image downloaded', 'success');
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Save failed:', err);
            showToast('Failed to save image', 'error');
        }
    }
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
                <div class="gallery-image-wrapper">
                    <img src="${API_BASE}${image.url}" alt="Generated image" loading="lazy">
                    <div class="gallery-actions">
                        <button type="button" class="gallery-action-btn view-btn" title="View Fullscreen">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                        <button type="button" class="gallery-action-btn download-btn" title="Download">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
                            </svg>
                        </button>
                        <button type="button" class="gallery-action-btn delete-btn" data-filename="${image.filename}" title="Delete">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="gallery-info">
                    <p class="gallery-prompt" title="${image.metadata?.prompt}">${image.metadata?.prompt || 'No prompt'}</p>
                    <div class="gallery-meta-tags">
                        <span class="meta-tag" title="Resolution">${image.metadata?.width}×${image.metadata?.height}</span>
                        <span class="meta-tag" title="Steps">${image.metadata?.steps} steps</span>
                        <span class="meta-tag" title="Generation Time">${formatTime(image.metadata?.generation_time)}</span>
                        <span class="meta-tag" title="Seed">Seed: ${image.metadata?.seed}</span>
                    </div>
                </div>
            `;

            // View button
            const viewBtn = item.querySelector('.view-btn');
            viewBtn.addEventListener('click', () => openFullscreen(`${API_BASE}${image.url}`));

            // Download button
            const downloadBtn = item.querySelector('.download-btn');
            downloadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    // Fetch the image as a blob
                    const response = await fetch(`${API_BASE}${image.url}`);
                    if (!response.ok) throw new Error('Network response was not ok');
                    const blob = await response.blob();

                    // Use File System Access API if available
                    if (window.showSaveFilePicker) {
                        try {
                            const handle = await window.showSaveFilePicker({
                                suggestedName: image.filename,
                                types: [{
                                    description: 'PNG Image',
                                    accept: { 'image/png': ['.png'] },
                                }],
                            });
                            const writable = await handle.createWritable();
                            await writable.write(blob);
                            await writable.close();
                            showToast('Image saved successfully', 'success');
                            return;
                        } catch (err) {
                            if (err.name === 'AbortError') return;
                        }
                    }

                    // Classic download fallback
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    link.href = url;
                    link.download = image.filename;
                    // link.target = '_blank'; // Removed to prevent opening in new tab
                    document.body.appendChild(link);
                    link.click();

                    setTimeout(() => {
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(link);
                    }, 100);

                } catch (error) {
                    console.error('Download error:', error);
                    showToast('Download failed', 'error');
                }
            });

            // Delete button
            const deleteBtn = item.querySelector('.delete-btn');
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
            loadModels(true); // Refresh models with new key
        } else {
            throw new Error('Invalid API key');
        }
    } catch (error) {
        showToast('Invalid API key', 'error');
    }
}

function updateKeyDisplay() {
    const storedKey = localStorage.getItem('openrouter_api_key');
    if (storedKey && storedKey.length > 4) {
        elements.currentKeyDisplay.style.display = 'block';
        elements.keyLastChars.textContent = storedKey.slice(-4);
    } else {
        elements.currentKeyDisplay.style.display = 'none';
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
