import './style.css';

// Interfaces matching backend models
interface FuelMix {
  fuel: string;
  perc: number;
}

interface IntensityResponse {
  from?: string;
  to?: string;
  forecast?: number;
  intensity?: number;
  actual?: number | null;
  index: string;
  postcode?: string;
  region?: string;
  generationmix?: FuelMix[];
}

interface ScheduleResponse {
  startTime: string;
  endTime: string;
  averageIntensity: number;
  savingsPercentage: number;
}

// Map index values to css classes and text colors
const indexColors: Record<string, { class: string; border: string; glow: string }> = {
  very: { class: 'badge-low', border: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' }, // very low
  low: { class: 'badge-low', border: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
  moderate: { class: 'badge-moderate', border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
  high: { class: 'badge-high', border: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
  veryhigh: { class: 'badge-high', border: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' }, // very high
};

// Elements
const postcodeForm = document.getElementById('postcode-form') as HTMLFormElement;
const postcodeInput = document.getElementById('postcode-input') as HTMLInputElement;
const regionBadge = document.getElementById('region-badge') as HTMLSpanElement;
const intensityValue = document.getElementById('intensity-value') as HTMLSpanElement;
const intensityLevelBadge = document.getElementById('intensity-level-badge') as HTMLSpanElement;
const generationMixList = document.getElementById('generation-mix-list') as HTMLDivElement;

const durationRange = document.getElementById('duration-range') as HTMLInputElement;
const durationDisplay = document.getElementById('duration-display') as HTMLSpanElement;
const schedulerForm = document.getElementById('scheduler-form') as HTMLFormElement;
const schedulerResults = document.getElementById('scheduler-results') as HTMLDivElement;
const savingsVal = document.getElementById('savings-val') as HTMLDivElement;
const bestStartVal = document.getElementById('best-start-val') as HTMLSpanElement;
const endTimeVal = document.getElementById('end-time-val') as HTMLSpanElement;
const avgIntensityVal = document.getElementById('avg-intensity-val') as HTMLSpanElement;
const timelineInsightText = document.getElementById('timeline-insight-text') as HTMLParagraphElement;
const intensityCircle = document.querySelector('.intensity-circle-outer') as HTMLDivElement;

const glow1 = document.getElementById('glow1') as HTMLDivElement;
const glow2 = document.getElementById('glow2') as HTMLDivElement;

// Helper to format ISO dates to friendly local text
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  
  const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const formattedTime = date.toLocaleTimeString([], optionsTime);
  
  // Reset time for calendar day comparisons
  const dateCopy = new Date(date);
  dateCopy.setHours(0, 0, 0, 0);
  const todayCopy = new Date(now);
  todayCopy.setHours(0, 0, 0, 0);
  
  const diffTime = dateCopy.getTime() - todayCopy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${formattedTime}`;
  } else if (diffDays === 1) {
    return `Tomorrow at ${formattedTime}`;
  } else {
    const optionsDate: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return `${date.toLocaleDateString([], optionsDate)} at ${formattedTime}`;
  }
}

// Update Duration range text
durationRange.addEventListener('input', () => {
  durationDisplay.textContent = parseFloat(durationRange.value).toFixed(1);
});

// Update Intensity UI
function updateIntensityUI(data: IntensityResponse) {
  // Update values
  intensityValue.textContent = (data.forecast ?? data.intensity ?? 0).toString();
  regionBadge.textContent = data.region || 'National Grid';

  // Normalise index names
  const rawIndex = data.index.toLowerCase().replace(/\s+/g, '');
  const config = indexColors[rawIndex] || indexColors.moderate;

  // Update badge styling
  intensityLevelBadge.textContent = data.index;
  intensityLevelBadge.className = `badge ${config.class}`;

  // Update outer circle ring color to reflect intensity level
  intensityCircle.style.borderColor = config.border;
  intensityCircle.style.boxShadow = `0 10px 25px rgba(0, 0, 0, 0.2), 0 0 20px ${config.glow}`;

  // Adjust background ambient glows dynamically
  if (rawIndex === 'low' || rawIndex === 'verylow') {
    glow1.style.background = 'radial-gradient(circle, rgba(16, 185, 129, 0.5) 0%, rgba(0,0,0,0) 70%)';
    glow2.style.background = 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(0,0,0,0) 70%)';
  } else if (rawIndex === 'high' || rawIndex === 'veryhigh') {
    glow1.style.background = 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(0,0,0,0) 70%)';
    glow2.style.background = 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(0,0,0,0) 70%)';
  } else {
    glow1.style.background = 'radial-gradient(circle, rgba(99, 102, 241, 0.5) 0%, rgba(0,0,0,0) 70%)';
    glow2.style.background = 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(0,0,0,0) 70%)';
  }

  // Render generation mix if provided (fallback list if not)
  const defaultMix: FuelMix[] = [
    { fuel: 'wind', perc: 42.5 },
    { fuel: 'gas', perc: 28.1 },
    { fuel: 'nuclear', perc: 15.3 },
    { fuel: 'solar', perc: 7.2 },
    { fuel: 'hydro', perc: 3.1 },
    { fuel: 'biomass', perc: 2.8 },
    { fuel: 'coal', perc: 1.0 }
  ];

  const mix = data.generationmix || defaultMix;
  renderGenerationMix(mix);
}

// Render fuel mix progress bars
function renderGenerationMix(mix: FuelMix[]) {
  generationMixList.innerHTML = '';
  
  // Sort mix by percentage descending
  const sortedMix = [...mix].sort((a, b) => b.perc - a.perc);

  const cleanFuels = ['wind', 'solar', 'hydro', 'nuclear', 'biomass'];

  sortedMix.forEach(item => {
    if (item.perc === 0) return; // Skip unused sources

    const isClean = cleanFuels.includes(item.fuel.toLowerCase());
    
    const fuelItem = document.createElement('div');
    fuelItem.className = `fuel-item ${isClean ? 'clean' : 'fossil'}`;
    
    fuelItem.innerHTML = `
      <div class="fuel-info">
        <span class="fuel-name">${item.fuel}</span>
        <span class="fuel-perc">${item.perc}%</span>
      </div>
      <div class="fuel-bar-container">
        <div class="fuel-bar" style="width: 0%"></div>
      </div>
    `;

    generationMixList.appendChild(fuelItem);

    // Trigger animation frame for progress bars
    requestAnimationFrame(() => {
      const bar = fuelItem.querySelector('.fuel-bar') as HTMLDivElement;
      if (bar) bar.style.width = `${item.perc}%`;
    });
  });
}

// Fetch live intensity data (on-load/postcode)
async function fetchCurrentIntensity(postcode?: string) {
  try {
    const url = postcode 
      ? `/api/intensity/current?postcode=${encodeURIComponent(postcode)}`
      : '/api/intensity/current';
    
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to retrieve intensity');
    }
    
    const data: IntensityResponse = await response.json();
    updateIntensityUI(data);
  } catch (error: any) {
    alert(`Error: ${error.message || 'Grid data unavailable'}`);
    console.error(error);
  }
}

// Submit postcode form
postcodeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = postcodeInput.value.trim();
  if (!code) {
    // Empty reset to national
    await fetchCurrentIntensity();
  } else {
    await fetchCurrentIntensity(code);
  }
});

// Run Workload Scheduler
schedulerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const duration = durationRange.value;

  try {
    const response = await fetch(`/api/scheduler/optimize?durationHours=${duration}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to optimize schedule');
    }

    const data: ScheduleResponse = await response.json();

    // Render results
    savingsVal.textContent = `${Math.round(data.savingsPercentage)}%`;
    bestStartVal.textContent = formatDateTime(data.startTime);
    endTimeVal.textContent = formatDateTime(data.endTime);
    avgIntensityVal.textContent = `${Math.round(data.averageIntensity)} gCO₂/kWh`;

    // Make results panel visible
    schedulerResults.classList.remove('hidden');
    schedulerResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Custom helper feedback text
    const savings = Math.round(data.savingsPercentage);
    if (savings > 15) {
      timelineInsightText.innerHTML = `Running your task at <strong>${formatDateTime(data.startTime)}</strong> avoids peak grid demand times, resulting in a substantial carbon footprint reduction of <strong>${savings}%</strong>.`;
      timelineInsightText.style.borderColor = 'var(--accent)';
    } else if (savings > 0) {
      timelineInsightText.innerHTML = `Starting at <strong>${formatDateTime(data.startTime)}</strong> is slightly cleaner than starting immediately, saving <strong>${savings}%</strong> in emissions.`;
      timelineInsightText.style.borderColor = 'var(--primary)';
    } else {
      timelineInsightText.innerHTML = `The grid is currently operating at optimal efficiency! Starting your task immediately is the cleanest available option.`;
      timelineInsightText.style.borderColor = 'var(--text-muted)';
    }

  } catch (error: any) {
    alert(`Scheduler Error: ${error.message}`);
    console.error(error);
  }
});

// Initial Load
fetchCurrentIntensity();

// AI Chat Widget Elements
const chatToggleBtn = document.getElementById('chat-toggle-btn') as HTMLButtonElement;
const chatWindow = document.getElementById('chat-window') as HTMLDivElement;
const chatCloseBtn = document.getElementById('chat-close-btn') as HTMLButtonElement;
const chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
const chatInputForm = document.getElementById('chat-input-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const chatSuggestions = document.getElementById('chat-suggestions') as HTMLDivElement;

// Toggle Chat Window
chatToggleBtn.addEventListener('click', () => {
  chatWindow.classList.toggle('hidden');
  if (!chatWindow.classList.contains('hidden')) {
    chatInput.focus();
    scrollToBottom();
    // Hide pulse dot when user first opens the chat
    const pulseDot = chatToggleBtn.querySelector('.chat-pulse-dot') as HTMLSpanElement;
    if (pulseDot) pulseDot.style.display = 'none';
  }
});

chatCloseBtn.addEventListener('click', () => {
  chatWindow.classList.add('hidden');
});

// Helper to scroll messages to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render message helper
function appendMessage(text: string, sender: 'user' | 'agent' | 'system') {
  const messageEl = document.createElement('div');
  messageEl.className = `message message-${sender}`;
  
  // Convert basic markdown-like elements (e.g. **bold**, *italic*) to HTML
  const formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

  messageEl.innerHTML = formattedText;
  chatMessages.appendChild(messageEl);
  scrollToBottom();
}

// Show/Hide typing indicator
let typingIndicator: HTMLDivElement | null = null;
function showTypingIndicator() {
  if (typingIndicator) return;
  typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator message-agent';
  typingIndicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  chatMessages.appendChild(typingIndicator);
  scrollToBottom();
}

function hideTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.remove();
    typingIndicator = null;
  }
}

// Handle chat query submit
async function handleChatSubmit(text: string) {
  const query = text.trim();
  if (!query) return;

  // Clear input
  chatInput.value = '';

  // Append user message
  appendMessage(query, 'user');

  // Show typing indicator
  showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: query })
    });

    if (!response.ok) {
      throw new Error('Server returned an error');
    }

    const data = await response.json();
    hideTypingIndicator();
    appendMessage(data.response, 'agent');
  } catch (error: any) {
    hideTypingIndicator();
    appendMessage('Sorry, I encountered an issue connecting to the EcoPulse AI service. Please try again later.', 'system');
    console.error('Chat error:', error);
  }
}

// Submit via Form
chatInputForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value;
  handleChatSubmit(text);
});

// Handle suggestions
chatSuggestions.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest('.suggestion-chip') as HTMLButtonElement;
  if (button) {
    const text = button.textContent || '';
    handleChatSubmit(text);
  }
});

// Load configuration on initialization and hide the chat widget if the AI agent is disabled
async function initializeConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      if (config.enableAiAgent === false) {
        if (chatToggleBtn) chatToggleBtn.style.display = 'none';
        if (chatWindow) chatWindow.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Failed to load application configuration:', error);
  }
}
initializeConfig();

