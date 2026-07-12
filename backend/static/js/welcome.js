const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

// Gate state tracker
const gates = {
    1: { queue: [], activeStudent: null, displayStartTime: null, timerId: null },
    2: { queue: [], activeStudent: null, displayStartTime: null, timerId: null },
    3: { queue: [], activeStudent: null, displayStartTime: null, timerId: null },
    4: { queue: [], activeStudent: null, displayStartTime: null, timerId: null },
    5: { queue: [], activeStudent: null, displayStartTime: null, timerId: null }
};

let socket = null;
const reconnectInterval = 3000;

// Initialize WebSocket connection
function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/ws/checkins`;

    console.log(`[*] Connecting to WebSocket: ${wsUrl}`);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('[+] WebSocket connected.');
        updateLiveIndicator(true);
    };

    socket.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'checkin') {
                handleCheckInEvent(payload.data);
            }
        } catch (err) {
            console.error('[!] Error parsing WebSocket message:', err);
        }
    };

    socket.onclose = () => {
        console.log('[!] WebSocket connection closed. Attempting reconnect...');
        updateLiveIndicator(false);
        setTimeout(connectWebSocket, reconnectInterval);
    };

    socket.onerror = (error) => {
        console.error('[!] WebSocket error:', error);
        socket.close();
    };
}

// Update the live status indicator UI
function updateLiveIndicator(isConnected) {
    const indicator = document.getElementById('live-indicator');
    const dot = indicator.querySelector('span');

    if (isConnected) {
        indicator.style.backgroundColor = 'var(--success-light)';
        indicator.style.color = 'var(--success)';
        indicator.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        dot.style.backgroundColor = 'var(--success)';
    } else {
        indicator.style.backgroundColor = 'var(--danger-light)';
        indicator.style.color = 'var(--danger)';
        indicator.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        dot.style.backgroundColor = 'var(--danger)';
    }
}

// Determine which gate column to place the student in based on scanner's username
function getGateNumber(username) {
    if (!username) return 1;
    // Match trailing digits in the username, e.g. security3 -> 3
    const match = username.match(/\d+/);
    if (match) {
        const num = parseInt(match[0], 10);
        if (num >= 1 && num <= 5) {
            return num;
        }
    }
    // Default fallback or round-robin for admin/unrecognized
    return 1;
}

// Handle incoming check-in event
function handleCheckInEvent(studentData) {
    const username = studentData.scanned_by_username || '';
    const gateNum = getGateNumber(username);

    gates[gateNum].queue.push(studentData);
    updateQueueBadge(gateNum);

    // If no student is currently being displayed on this gate, start processing the queue
    if (gates[gateNum].activeStudent === null) {
        processQueue(gateNum);
    }
}

// Update the visual queue badge count
function updateQueueBadge(gateNum) {
    const badge = document.getElementById(`gate-queue-${gateNum}`);
    const queueLength = gates[gateNum].queue.length;

    if (queueLength > 0) {
        badge.textContent = `${queueLength} waiting`;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// Process the next student in the queue for a gate
function processQueue(gateNum) {
    const gate = gates[gateNum];

    // Safety check: clear any running timer
    if (gate.timerId) {
        clearTimeout(gate.timerId);
        gate.timerId = null;
    }

    if (gate.queue.length === 0) {
        // No student waiting in queue.
        // We let the current student remain on the screen.
        // But we reset activeStudent to null so the next check-in is displayed immediately.
        gate.activeStudent = null;
        gate.displayStartTime = null;
        return;
    }

    // Pop next student from queue
    const nextStudent = gate.queue.shift();
    gate.activeStudent = nextStudent;
    gate.displayStartTime = Date.now();

    // Update queue badge count
    updateQueueBadge(gateNum);

    // Render and animate the new student card
    renderStudent(gateNum, nextStudent);

    // Set 5-second minimum display timer
    gate.timerId = setTimeout(() => {
        processQueue(gateNum);
    }, 5000);
}

// Render student details with fade transitions and confetti
function renderStudent(gateNum, student) {
    const card = document.getElementById(`gate-card-${gateNum}`);

    // 1. Trigger Fade Out
    card.classList.add('fade-out');

    // Wait for fade out animation to finish (500ms matching CSS transition)
    setTimeout(() => {
        // Hide placeholder elements
        const placeholder = card.querySelector('.placeholder-card');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        // Ensure student display elements are visible
        const photoContainer = card.querySelector('.student-photo-container');
        const nameEl = document.getElementById(`gate-name-${gateNum}`);
        const typeBadgeEl = document.getElementById(`gate-type-badge-${gateNum}`);
        const typeEl = document.getElementById(`gate-type-${gateNum}`);
        const deptEl = document.getElementById(`gate-dept-${gateNum}`);
        const regEl = document.getElementById(`gate-reg-${gateNum}`);
        const timeContainer = document.getElementById(`gate-time-container-${gateNum}`);
        const timeEl = document.getElementById(`gate-time-${gateNum}`);

        photoContainer.style.display = 'block';
        nameEl.style.display = 'block';
        typeBadgeEl.style.display = 'block';
        deptEl.style.display = 'block';
        regEl.style.display = 'block';
        timeContainer.style.display = 'block';

        // Update values
        const photoEl = document.getElementById(`gate-photo-${gateNum}`);
        if (student.photo_url) {
            photoEl.src = student.photo_url;
        } else {
            // Default elegant avatar
            photoEl.src = DEFAULT_AVATAR;
        }

        photoEl.classList.add('active-pulse');
        nameEl.textContent = student.name;

        // Set type badge class dynamically
        typeEl.textContent = student.type.toUpperCase();
        typeEl.className = `badge badge-${student.type}`;

        deptEl.textContent = student.department || 'N/A';
        regEl.textContent = `Reg No: ${student.register_number}`;

        // Check-in time
        const checkInTime = new Date(student.scanned_at || Date.now());
        timeEl.textContent = checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Remove waiting placeholder styles
        card.classList.remove('waiting');

        // 2. Trigger Fade In
        card.classList.remove('fade-out');
        card.classList.add('fade-in');

        // 3. Fire Confetti centered on the gate column
        triggerConfettiForGate(gateNum);

        // 4. Remove fade-in class after transition completes
        setTimeout(() => {
            card.classList.remove('fade-in');
        }, 500);
    }, 500);
}

// Fire canvas confetti from the center of the specific gate column
function triggerConfettiForGate(gateNum) {
    const col = document.getElementById(`gate-col-${gateNum}`);
    if (!col) return;

    const rect = col.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 3) / window.innerHeight; // Launch from top-middle region

    confetti({
        particleCount: 60,
        spread: 55,
        origin: { x: x, y: y },
        colors: ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#d8b4fe'],
        disableForReducedMotion: true
    });
}

// Start WebSocket connection on page load
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});
