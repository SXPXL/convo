/**
 * Scanner Page Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session check
    const currentStaff = await checkAuthSession(['security', 'admin']);
    if (!currentStaff) return;

    // DOM Elements
    const cameraSelect = document.getElementById('camera-select');
    const scannerStatus = document.getElementById('scanner-status');
    const viewfinderGuides = document.getElementById('viewfinder-guides');
    const manualScanForm = document.getElementById('manual-scan-form');
    const manualIdInput = document.getElementById('manual-id');
    
    // Modal Details Elements
    const verificationModal = document.getElementById('verification-modal');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');
    const userTypeBadge = document.getElementById('user-type-badge');
    const statusBanner = document.getElementById('status-banner');
    const detailAdmission = document.getElementById('detail-admission');
    const detailAdmissionVal = document.getElementById('detail-admission-val');
    const detailAdmissionRow = document.getElementById('detail-admission-row');
    const detailDept = document.getElementById('detail-dept');
    const detailDeptRow = document.getElementById('detail-dept-row');
    const detailSeat = document.getElementById('detail-seat');
    const detailLink = document.getElementById('detail-link');
    const detailLinkRow = document.getElementById('detail-link-row');
    const scannedAtRow = document.getElementById('scanned-at-row');
    const detailScannedAt = document.getElementById('detail-scanned-at');
    
    const allowEntryBtn = document.getElementById('allow-entry-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Alignment Container Elements
    const normalUserContainer = document.getElementById('normal-user-container');
    const alignmentContainer = document.getElementById('alignment-container');
    const alignStudentName = document.getElementById('align-student-name');
    const alignPhotoRadioA = document.getElementById('align-photo-radio-a');
    const alignPhotoRadioB = document.getElementById('align-photo-radio-b');
    const alignPhotoImgA = document.getElementById('align-photo-img-a');
    const alignPhotoImgB = document.getElementById('align-photo-img-b');
    const alignNameRadioA = document.getElementById('align-name-radio-a');
    const alignNameRadioB = document.getElementById('align-name-radio-b');
    const alignNameTextA = document.getElementById('align-name-text-a');
    const alignNameTextB = document.getElementById('align-name-text-b');
    const alignSubmitBtn = document.getElementById('align-submit-btn');
    const alignCancelBtn = document.getElementById('align-cancel-btn');

    // State variables
    let html5Qrcode = null;
    let currentCameraId = null;
    let activeAdmissionNumber = null;
    let isProcessing = false;
    let alignmentData = null; // Stores scanned guest info when alignment is required

    // Initialize HTML5 QR Code Scanner
    try {
        html5Qrcode = new Html5Qrcode("reader");
        await requestCameras();
    } catch (err) {
        console.error("Failed to initialize scanner: ", err);
        scannerStatus.textContent = "Error: Camera access not supported.";
    }

    async function requestCameras() {
        try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                cameraSelect.innerHTML = '<option value="">-- Select Camera --</option>';
                let defaultIndex = 1; // Default fallback to first listed camera
                
                devices.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.textContent = device.label || `Camera ${index + 1}`;
                    cameraSelect.appendChild(option);
                    
                    const labelLower = (device.label || "").toLowerCase();
                    if (labelLower.includes('back') || labelLower.includes('rear') || labelLower.includes('environment')) {
                        defaultIndex = index + 1; // offset by 1 due to placeholder option
                    }
                });
                
                scannerStatus.textContent = "Scanner ready. Select camera to start.";
                
                // Automatically select first camera or back camera if found
                cameraSelect.selectedIndex = defaultIndex;
                handleCameraChange();
            } else {
                cameraSelect.innerHTML = '<option value="">No cameras detected</option>';
                scannerStatus.textContent = "No camera hardware detected.";
            }
        } catch (e) {
            cameraSelect.innerHTML = '<option value="">Permission Denied</option>';
            scannerStatus.textContent = "Camera permission denied.";
        }
    }

    async function handleCameraChange() {
        const selectedId = cameraSelect.value;
        
        // Stop running scanner first
        if (html5Qrcode.isScanning) {
            viewfinderGuides.style.display = 'none';
            await html5Qrcode.stop();
        }

        if (!selectedId) {
            scannerStatus.textContent = "Scanner stopped.";
            return;
        }

        currentCameraId = selectedId;
        scannerStatus.textContent = "Starting camera...";
        
        try {
            await html5Qrcode.start(
                currentCameraId,
                {
                    fps: 10,
                    qrbox: (width, height) => {
                        const size = Math.min(width, height) * 0.7;
                        return { width: size, height: size };
                    }
                },
                onQrCodeScanned,
                onQrCodeScanError
            );
            scannerStatus.textContent = "Scanning active...";
            viewfinderGuides.style.display = 'block';
        } catch (err) {
            console.error("Error starting camera scanner: ", err);
            scannerStatus.textContent = "Failed to start camera.";
            Modal.show({
                title: 'Camera Error',
                message: 'Failed to access selected camera. Please try another source.',
                type: 'danger'
            });
        }
    }

    cameraSelect.addEventListener('change', handleCameraChange);

    function onQrCodeScanned(decodedText, decodedResult) {
        if (isProcessing) return;
        
        // Lock scanner processing
        isProcessing = true;
        
        // Vibrate to notify user
        if (navigator.vibrate) navigator.vibrate(100);
        
        verifyAttendee(decodedText);
    }

    function onQrCodeScanError(errorMessage) {
        // Silent logging of viewfinder scanner adjustments
    }

    // Manual Verify Form
    manualScanForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = manualIdInput.value.trim().toUpperCase();
        if (!value) return;
        
        isProcessing = true;
        verifyAttendee(value);
    });

    // Verification Logic
    async function verifyAttendee(admissionNumber) {
        activeAdmissionNumber = admissionNumber;
        scannerStatus.textContent = `Verifying: ${admissionNumber}...`;

        try {
            const response = await secureFetch(`/api/scanner/user/${admissionNumber}`);
            const data = await response.json();

            if (response.ok) {
                playBeep(600, 100); // Scan success sound
                displayAttendeeModal(data);
            } else {
                Modal.show({
                    title: 'Verification Error',
                    message: data.detail || 'Attendee record not found.',
                    type: 'danger',
                    onConfirm: () => {
                        resetScannerUI();
                    }
                });
            }
        } catch (error) {
            Modal.show({
                title: 'Connection Error',
                message: 'Could not connect to database verification endpoint.',
                type: 'danger',
                onConfirm: () => {
                    resetScannerUI();
                }
            });
        }
    }

    function displayAttendeeModal(user) {
        if (user.alignment_required) {
            alignmentData = user;
            normalUserContainer.style.display = 'none';
            alignmentContainer.style.display = 'flex';
            
            alignStudentName.textContent = user.student_name || 'N/A';
            
            // Populate photo option A
            alignPhotoImgA.src = user.guardians[0].photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';
            alignPhotoRadioA.value = user.guardians[0].photo_url || '';
            alignPhotoRadioA.checked = false;
            
            // Populate photo option B
            alignPhotoImgB.src = user.guardians[1].photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';
            alignPhotoRadioB.value = user.guardians[1].photo_url || '';
            alignPhotoRadioB.checked = false;
            
            // Populate name option A
            alignNameTextA.textContent = user.guardians[0].name;
            alignNameRadioA.value = user.guardians[0].name;
            alignNameRadioA.checked = false;
            
            // Populate name option B
            alignNameTextB.textContent = user.guardians[1].name;
            alignNameRadioB.value = user.guardians[1].name;
            alignNameRadioB.checked = false;
            
            // Reset submit button state
            alignSubmitBtn.disabled = false;
            alignSubmitBtn.textContent = 'Confirm & Allow Entry';
            
            // Trigger modal visibility
            verificationModal.classList.add('active');
            scannerStatus.textContent = "Guest alignment required.";
            return;
        }

        // Normal flow
        alignmentData = null;
        normalUserContainer.style.display = 'flex';
        alignmentContainer.style.display = 'none';

        // Load details
        userName.textContent = user.name;
        detailAdmission.textContent = user.register_number;
        if (user.admission_number) {
            detailAdmissionRow.style.display = 'flex';
            detailAdmissionVal.textContent = user.admission_number;
        } else {
            detailAdmissionRow.style.display = 'none';
        }
        detailSeat.textContent = user.seat_number || 'N/A';
        
        // Setup profile image (placeholder if none exists)
        userPhoto.src = user.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';
        
        // Reset animations
        userPhoto.className = 'scanned-user-photo';

        // Type formatting
        userTypeBadge.textContent = user.type.toUpperCase();
        if (user.type === 'student') {
            userTypeBadge.className = 'badge badge-student';
            detailDeptRow.style.display = 'flex';
            detailDept.textContent = user.department || 'General';
            detailLinkRow.style.display = 'none';
        } else {
            userTypeBadge.className = 'badge badge-guardian';
            detailDeptRow.style.display = 'none';
            detailLinkRow.style.display = 'flex';
            detailLink.textContent = user.linked_student_name || 'Student';
        }

        // Status logic
        if (user.entered) {
            // ALREADY ENTERED
            statusBanner.textContent = 'ALREADY CHECKED-IN';
            statusBanner.className = 'user-status-banner banner-denied';
            userPhoto.classList.add('danger-pulse');
            
            scannedAtRow.style.display = 'flex';
            detailScannedAt.textContent = formatDateTime(user.scanned_at);
            
            allowEntryBtn.style.display = 'none';
            playBeep(220, 300); // Low warning buzz
        } else {
            // READY TO CHECK-IN
            statusBanner.textContent = 'READY FOR CHECK-IN';
            statusBanner.className = 'user-status-banner banner-ready';
            
            scannedAtRow.style.display = 'none';
            allowEntryBtn.style.display = 'block';
            allowEntryBtn.disabled = false;
            allowEntryBtn.textContent = 'Allow Entry';
        }
        
        // Trigger modal visibility
        verificationModal.classList.add('active');
        scannerStatus.textContent = "Verifying scanned attendee card.";
    }

    // Allow Entry Check-in Registration
    allowEntryBtn.addEventListener('click', async () => {
        if (!activeAdmissionNumber) return;
        
        allowEntryBtn.disabled = true;
        allowEntryBtn.textContent = 'Registering...';

        try {
            const response = await secureFetch(`/api/scanner/entry/${activeAdmissionNumber}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (response.ok) {
                // Check-in success!
                statusBanner.textContent = 'ACCESS GRANTED';
                statusBanner.className = 'user-status-banner banner-granted';
                userPhoto.classList.add('success-pulse');
                
                scannedAtRow.style.display = 'flex';
                detailScannedAt.textContent = formatDateTime(data.entry.scanned_at);
                
                allowEntryBtn.style.display = 'none';
                
                // Audio cue (High pitch welcome beep)
                playBeep(880, 150); 
            } else {
                Modal.show({
                    title: 'Entry Rejected',
                    message: data.detail || 'Could not register entry.',
                    type: 'danger'
                });
                allowEntryBtn.disabled = false;
                allowEntryBtn.textContent = 'Allow Entry';
            }
        } catch (e) {
            Modal.show({
                title: 'Request Failed',
                message: 'Server error registering the entry.',
                type: 'danger'
            });
            allowEntryBtn.disabled = false;
            allowEntryBtn.textContent = 'Allow Entry';
        }
    });

    // Align Submit button listener
    alignSubmitBtn.addEventListener('click', async () => {
        if (!alignmentData) return;
        
        const selectedNameRadio = document.querySelector('input[name="align-name"]:checked');
        const selectedPhotoRadio = document.querySelector('input[name="align-photo"]:checked');
        
        if (!selectedNameRadio || !selectedPhotoRadio) {
            Modal.show({
                title: 'Selection Required',
                message: 'Please select exactly one correct photo and one correct name before confirming entry.',
                type: 'danger'
            });
            return;
        }
        
        alignSubmitBtn.disabled = true;
        alignSubmitBtn.textContent = 'Registering...';
        
        const payload = {
            scanned_register_number: alignmentData.scanned_user.register_number,
            selected_name: selectedNameRadio.value,
            selected_photo_url: selectedPhotoRadio.value
        };
        
        try {
            const response = await secureFetch('/api/scanner/align-guests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Play successful check-in beep (High pitch welcome beep)
                playBeep(880, 150);
                
                // Show success modal, then reset scanner
                Modal.show({
                    title: 'Entry Allowed',
                    message: `Successfully aligned and checked in:<br><strong>${data.user_name}</strong> (${data.register_number})`,
                    type: 'success',
                    onConfirm: () => {
                        resetScannerUI();
                    }
                });
            } else {
                Modal.show({
                    title: 'Alignment Failed',
                    message: data.detail || 'Could not align guest records.',
                    type: 'danger'
                });
                alignSubmitBtn.disabled = false;
                alignSubmitBtn.textContent = 'Confirm & Allow Entry';
            }
        } catch (err) {
            Modal.show({
                title: 'Connection Error',
                message: 'Could not connect to guest alignment API.',
                type: 'danger'
            });
            alignSubmitBtn.disabled = false;
            alignSubmitBtn.textContent = 'Confirm & Allow Entry';
        }
    });
    
    // Align Cancel button listener
    alignCancelBtn.addEventListener('click', resetScannerUI);

    // Close details modal and resume scanner
    closeModalBtn.addEventListener('click', resetScannerUI);

    function resetScannerUI() {
        // Hide details modal
        verificationModal.classList.remove('active');
        
        // Reset states
        activeAdmissionNumber = null;
        manualIdInput.value = '';
        
        // Delay scanner unlock slightly to prevent immediate re-trigger from same QR code
        setTimeout(() => {
            isProcessing = false;
            if (html5Qrcode && html5Qrcode.isScanning) {
                scannerStatus.textContent = "Scanning active...";
            } else {
                scannerStatus.textContent = "Scanner ready.";
            }
        }, 800);
    }

    // Audio helper for access status cues
    function playBeep(frequency, duration) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.value = frequency;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration/1000);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration/1000);
        } catch (e) {
            // Ignore if browser prevents audio autoplay
        }
    }
});
