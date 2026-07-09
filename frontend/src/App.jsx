import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Camera, 
  CameraOff, 
  CheckCircle, 
  AlertTriangle, 
  User, 
  Search, 
  RefreshCw, 
  Check, 
  Shield, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  UserCheck,
  AlertCircle
} from "lucide-react";

// API Base URL - Detect location or fallback to localhost
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  
  // Ticket / Scan state
  const [scannedCode, setScannedCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [ticketAttendees, setTicketAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  // UI States
  const [showManualInput, setShowManualInput] = useState(false);
  const [totalScansCount, setTotalScansCount] = useState(0);
  const [checkingInIds, setCheckingInIds] = useState(new Set());
  
  // Audio Feedback using Web Audio API
  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "success") {
        // High success chime
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "error") {
        // Low double buzz
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "check-in") {
        // Upward pleasant notification sound
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.25); // C6
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn("Audio feedback context blocked or unsupported:", e);
    }
  };

  // Device vibration helper
  const triggerVibrate = (duration = 200) => {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };

  // Handle successful barcode scans
  const handleScanSuccess = (decodedText) => {
    triggerVibrate(200);
    playSound("success");
    setScannedCode(decodedText);
    setScannerActive(false); // Stop scanner immediately so guard can process attendees
    fetchTicketDetails(decodedText);
  };

  // HTML5 Barcode Scanner Lifecycle
  useEffect(() => {
    let html5QrcodeScanner = null;
    setScannerError(null);

    if (scannerActive) {
      // Use Html5Qrcode for custom overlay control
      html5QrcodeScanner = new Html5Qrcode("reader");
      
      html5QrcodeScanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (width, height) => {
            // Optimized horizontal window for 1D barcodes
            const boxWidth = Math.floor(width * 0.85);
            const boxHeight = 110;
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Quietly ignore frame errors since they happen repeatedly until a code is aligned
        }
      ).catch(err => {
        console.error("Camera startup failed:", err);
        setScannerError("Camera permission denied, or device is currently using the camera in another app.");
        setScannerActive(false);
      });
    }

    return () => {
      if (html5QrcodeScanner) {
        if (html5QrcodeScanner.isScanning) {
          html5QrcodeScanner.stop().catch(err => {
            console.error("Error stopping scanner:", err);
          });
        }
      }
    };
  }, [scannerActive]);

  // API Call: Fetch Ticket details & attendees
  const fetchTicketDetails = async (ticketId) => {
    if (!ticketId) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await fetch(`${API_BASE}/api/scan/${encodeURIComponent(ticketId.trim())}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Ticket not found. Verify Code.");
        }
        throw new Error("Network error. Try again.");
      }
      const data = await response.json();
      setTicketAttendees(data);
      setTotalScansCount(prev => prev + 1);
      
      // If the ticket is fully redeemed, play error buzz warning
      const allRedeemed = data.length > 0 && data.every(a => a.has_entered);
      if (allRedeemed) {
        playSound("error");
        triggerVibrate([100, 50, 100]);
      }
    } catch (err) {
      setApiError(err.message);
      setTicketAttendees([]);
      playSound("error");
      triggerVibrate([100, 50, 100]);
    } finally {
      setIsLoading(false);
    }
  };

  // API Call: Perform Check-in for an attendee
  const handleCheckIn = async (attendeeId) => {
    if (!attendeeId || checkingInIds.has(attendeeId)) return;
    
    // Double-click protection: Lock button state immediately
    setCheckingInIds(prev => {
      const next = new Set(prev);
      next.add(attendeeId);
      return next;
    });

    try {
      const response = await fetch(`${API_BASE}/api/check-in/${attendeeId}`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Check-in failed. Please try again.");
      }
      
      const updatedAttendee = await response.json();
      
      // Update local state immediately for instant UI feedback
      setTicketAttendees(prev => 
        prev.map(a => a.attendee_id === attendeeId ? updatedAttendee : a)
      );

      // Play success check-in chime
      playSound("check-in");
      triggerVibrate(80);
    } catch (err) {
      alert(err.message);
    } finally {
      // Release lock
      setCheckingInIds(prev => {
        const next = new Set(prev);
        next.delete(attendeeId);
        return next;
      });
    }
  };

  // Quick reset to scan a new ticket
  const handleReset = () => {
    setScannedCode("");
    setManualCode("");
    setTicketAttendees([]);
    setApiError(null);
    setScannerActive(true); // Restart camera scan automatically
  };

  // Check state of current ticket
  const totalAttendees = ticketAttendees.length;
  const enteredCount = ticketAttendees.filter(a => a.has_entered).length;
  const isFullyRedeemed = totalAttendees > 0 && enteredCount === totalAttendees;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-slate-800">
      
      {/* Top Header Guard Status Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500 animate-pulse" />
          <div>
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">GUARD-SCAN v1.0</h1>
            <p className="text-[10px] text-slate-400 font-mono">GATE-SECURITY PORTAL</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-md text-[11px] font-mono font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>ONLINE</span>
          <span className="text-slate-400">| Scans: {totalScansCount}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto pb-10">
        
        {/* Top Half: Camera Viewfinder / Scanner Container */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Scanner Viewfinder</h2>
            {scannerActive && (
              <button 
                onClick={() => setScannerActive(false)}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
              >
                <CameraOff className="w-3.5 h-3.5" /> Disable Camera
              </button>
            )}
          </div>

          {scannerActive ? (
            <div className="relative w-full h-64 bg-black overflow-hidden rounded-2xl border border-slate-800 shadow-inner">
              {/* Scan box viewport overlay */}
              <div id="reader" className="w-full h-full object-cover"></div>
              
              {/* Custom Viewfinder overlays with styling */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-[85%] h-[110px] border-2 border-emerald-500/50 rounded-xl relative flex items-center justify-center bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  {/* Active scanning red laser line */}
                  <div className="w-full h-[2px] bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-pulse"></div>
                  
                  {/* Corner indicator details */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
                </div>
                <span className="text-[10px] text-emerald-400 mt-3 font-semibold tracking-widest bg-slate-900/90 px-3 py-1 rounded-full border border-emerald-500/20 backdrop-blur-sm">
                  ALIGN BARCODE HORIZONTALLY
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-64 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center gap-4 text-center p-6 backdrop-blur-sm relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none"></div>
              <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700/50 text-slate-300 group-hover:scale-105 transition-transform duration-300">
                <Camera className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Camera Scanner is Inactive</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[250px] mx-auto">Activate the high-performance camera system to scan Code 128 event tickets.</p>
              </div>
              <button
                onClick={() => setScannerActive(true)}
                className="w-full max-w-[200px] bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all duration-150 transform active:scale-95 text-sm"
              >
                Start Scanner Camera
              </button>
            </div>
          )}

          {scannerError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/50 text-rose-300 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{scannerError}</p>
            </div>
          )}
        </section>

        {/* Accordion: Manual Entry Input Fallback */}
        <section className="border border-slate-800 bg-slate-900/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowManualInput(prev => !prev)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold tracking-wider text-slate-300 hover:bg-slate-800/20 transition-all uppercase"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              Manual Code Lookup
            </span>
            {showManualInput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showManualInput && (
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. TICKET-12345"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setScannedCode(manualCode);
                      fetchTicketDetails(manualCode);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    setScannedCode(manualCode);
                    fetchTicketDetails(manualCode);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 font-semibold text-sm transition-all flex items-center gap-2"
                >
                  Lookup
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Use this manual mode if physical tickets or mobile screens are too scratched, bright, or damaged to scan.
              </p>
            </div>
          )}
        </section>

        {/* Global Warning Banner: TICKET FULLY REDEEMED */}
        {isFullyRedeemed && (
          <div className="p-4 bg-rose-950/70 border border-rose-800/80 rounded-2xl flex flex-col items-center gap-2 text-center animate-bounce shadow-xl">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wider text-rose-300 uppercase">TICKET FULLY REDEEMED</h3>
              <p className="text-xs text-rose-200 font-medium mt-0.5">DENY ENTRY TO ALL ATTEENDEES ON THIS CODE</p>
            </div>
          </div>
        )}

        {/* Bottom Half: Details Panel */}
        <section className="flex-1 flex flex-col gap-3">
          {/* Header section when we have results */}
          {(scannedCode || ticketAttendees.length > 0) && (
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">TICKET STATUS</h3>
                <p className="text-sm font-mono font-semibold text-emerald-400">{scannedCode || "MANUAL SEARCH"}</p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Scan Next
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-400">Fetching ticket and attendee manifests...</p>
            </div>
          )}

          {/* API Error state */}
          {apiError && !isLoading && (
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-6 text-center flex flex-col items-center gap-3 py-10">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200">Scan Failed / Not Found</h4>
                <p className="text-xs text-slate-400 mt-1">{apiError}</p>
              </div>
              <button
                onClick={handleReset}
                className="mt-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Scan Another Ticket
              </button>
            </div>
          )}

          {/* Success state: List attendees */}
          {ticketAttendees.length > 0 && !isLoading && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Manifest Count</span>
                <span className="text-xs font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-emerald-400">
                  {enteredCount} / {totalAttendees} ENTERED
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {ticketAttendees.map((attendee) => {
                  const isCheckedIn = attendee.has_entered;
                  const isProcessing = checkingInIds.has(attendee.attendee_id);
                  const entryTime = attendee.entry_timestamp 
                    ? new Date(attendee.entry_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : "";

                  return (
                    <div 
                      key={attendee.attendee_id}
                      className={`relative flex gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                        isCheckedIn 
                          ? "bg-slate-950 border-slate-900/80 opacity-60" 
                          : "bg-slate-900/80 border-slate-800 shadow-md hover:border-slate-700/50"
                      }`}
                    >
                      {/* Left: Profile Picture Container */}
                      <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
                        {attendee.photo_url ? (
                          <img 
                            src={attendee.photo_url} 
                            alt={attendee.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-10 h-10 text-slate-600" />
                        )}

                        {/* Banner across face if checked in */}
                        {isCheckedIn && (
                          <div className="absolute inset-0 bg-rose-950/80 flex items-center justify-center p-0.5">
                            <span className="text-[10px] font-black text-rose-300 tracking-wider text-center rotate-[-12deg] uppercase border border-rose-500/40 px-1 py-0.5 bg-rose-950 shadow-sm leading-tight">
                              ALREADY ENTERED
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Attendee details and actions */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="font-bold text-slate-100 text-sm truncate">{attendee.name}</h4>
                            <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase shrink-0 border ${
                              attendee.role === "Primary" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}>
                              {attendee.role}
                            </span>
                          </div>
                          
                          {isCheckedIn && entryTime && (
                            <p className="text-[11px] text-rose-400 font-mono mt-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Checked-in at {entryTime}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="mt-2.5">
                          {isCheckedIn ? (
                            <button
                              disabled
                              className="w-full bg-slate-900 text-slate-500 border border-slate-800 text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Entry Confirmed
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCheckIn(attendee.attendee_id)}
                              disabled={isProcessing}
                              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-extrabold py-2 rounded-xl flex items-center justify-center gap-1.5 shadow transition-all duration-150 transform active:scale-98 select-none"
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Permitting...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 stroke-[3]" />
                                  PERMIT ENTRY
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty initial state */}
          {!scannedCode && ticketAttendees.length === 0 && !isLoading && !apiError && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 py-12 border border-slate-900 bg-slate-900/10 rounded-2xl">
              <Shield className="w-12 h-12 text-slate-700 mb-3" />
              <h4 className="font-semibold text-slate-300">Ready to Scan</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                Scan a 1D barcode with the camera or look up a ticket ID manually to verify credentials.
              </p>
              
              <div className="mt-6 flex flex-col gap-2 w-full max-w-[200px]">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">DEMO BARCODES:</div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-slate-400 flex flex-col gap-1 text-left">
                  <div>🎟️ <span className="text-emerald-400">TICKET-12345</span> (Fresh)</div>
                  <div>🎟️ <span className="text-amber-400">TICKET-99999</span> (Partial)</div>
                  <div>🎟️ <span className="text-rose-400">TICKET-67890</span> (Redeemed)</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer System Status */}
      <footer className="bg-slate-950 border-t border-slate-900 p-3 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5 sticky bottom-0">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
        <span>ENCRYPTED CONNECTION</span>
        <span className="text-slate-800">•</span>
        <span>GATE SECURE A</span>
      </footer>

    </div>
  );
}

export default App;
