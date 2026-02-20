import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useOBS } from '../context/OBSContext';
import AICompanion from './AICompanion';
import CurrentTask from './CurrentTask';
import SettingsModal from './SettingsModal';
import SocialFeed from './SocialFeed';

const OverlayLayout = () => {
    const { isRecording, isConnected } = useOBS();
    const [layoutSettings, setLayoutSettings] = useState({
        showFaceCam: true,
        showHandCam: true,
        showRoomCam: true,
        socialGithub: "/abhayraghuwanshi",
        socialTwitter: "@ab_nhi_hai",
        socialLinkedin: "/in/abhayraghuwanshi",
        useGPU: true
    });
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        // Fetch initial layout settings from Local Node Backend
        fetch('http://127.0.0.1:8080/layout')
            .then(res => res.json())
            .then(data => setLayoutSettings(s => ({ ...s, ...data })))
            .catch(console.error);

        // Listen for live layout updates via WebSocket
        let ws;
        let reconnectTimeout;
        let isMounted = true;

        const connectWs = () => {
            if (!isMounted) return;
            ws = new WebSocket('ws://localhost:8080');
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'layout-update') {
                        setLayoutSettings(s => ({ ...s, ...data.payload }));
                    }
                } catch (e) { }
            };
            ws.onclose = () => {
                if (!isMounted) return;
                reconnectTimeout = setTimeout(connectWs, 3000);
            };
        };
        connectWs();

        return () => {
            isMounted = false;
            clearTimeout(reconnectTimeout);
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, []);

    const updateLayout = (updates) => {
        setLayoutSettings(s => ({ ...s, ...updates }));
        fetch('http://127.0.0.1:8080/layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }).catch(console.error);
    };

    const { showFaceCam, showHandCam, showRoomCam, socialGithub, socialTwitter, socialLinkedin, useGPU } = layoutSettings;

    return (
        // MAIN CONTAINER: w-screen h-screen ensures it fills ANY resolution
        <div className={`w-screen h-screen relative overflow-hidden font-inter transition-all duration-300 bg-obs-bg p-0 flex gap-0 ${isRecording ? 'border-[4px] border-red-500/50' : ''}`}>

            {/* Global Flash on Record */}
            {isRecording && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.2, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-red-500 pointer-events-none z-0"
                />
            )}

            {/* Status & Settings Group */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
                {/* Settings Toggle */}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1.5 rounded-full bg-black/40 backdrop-blur border border-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <SettingsComponents />
                </button>

                {/* Settings Modal */}
                <AnimatePresence>
                    {showSettings && (
                        <SettingsModal
                            onClose={() => setShowSettings(false)}
                            showFaceCam={showFaceCam} setShowFaceCam={(v) => updateLayout({ showFaceCam: v })}
                            showHandCam={showHandCam} setShowHandCam={(v) => updateLayout({ showHandCam: v })}
                            showRoomCam={showRoomCam} setShowRoomCam={(v) => updateLayout({ showRoomCam: v })}
                            socialGithub={socialGithub} setSocialGithub={(v) => updateLayout({ socialGithub: v })}
                            socialTwitter={socialTwitter} setSocialTwitter={(v) => updateLayout({ socialTwitter: v })}
                            socialLinkedin={socialLinkedin} setSocialLinkedin={(v) => updateLayout({ socialLinkedin: v })}
                            useGPU={useGPU} setUseGPU={(v) => updateLayout({ useGPU: v })}
                        />
                    )}
                </AnimatePresence>

                {/* Connection Status */}
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1 rounded-full border border-white/5 pointer-events-none">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-mono text-white/50 tracking-wider">OBS {isConnected ? 'LINKED' : 'OFFLINE'}</span>
                </div>
            </div>

            {/* --- LEFT COLUMN: WORK AREA (Main + Bottom Bar) --- */}
            {/* Using flex-col to stack Main Area + Bottom Widget */}
            <div className="flex-1 h-full min-w-0 relative z-10 flex flex-col">

                {/* 1. Main Work Area (Browser / VS Code) */}
                {/* flex-1 expands to fill remaining height (100% - 160px) */}
                {/* This leaves exactly ~900px height on 1080p screens, matching 16:9 perfectly */}
                <div className="flex-1 w-full relative group border-r border-white/5 bg-transparent">
                    {/* Floating Label */}
                    <div className="absolute top-2 left-4 px-2 py-0.5 bg-black text-white/30 text-[10px] font-mono uppercase tracking-widest border border-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Editor Focus
                    </div>
                </div>

                {/* 2. Bottom Bar: Current Task Widget */}
                {/* Fixed height (160px) fills the bottom gap */}
                <div className="h-44 w-full flex-shrink-0 border-t border-white/5 bg-black/80 backdrop-blur-md relative z-20">
                    <CurrentTask />
                </div>
            </div>


            {/* --- RIGHT COLUMN: SIDEBAR (Fixed Width) --- */}
            <div className="w-96 h-full flex flex-col gap-0 flex-shrink-0 relative z-10 border-l border-white/5 bg-black/40 backdrop-blur-sm transition-all duration-300">

                {/* 1. Face Cam (Toggleable) */}
                <AnimatePresence>
                    {showFaceCam && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="aspect-video w-full relative overflow-hidden bg-black border-b border-white/5 flex-shrink-0"
                        >
                            <div className="h-full w-full">
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 backdrop-blur rounded-full border border-white/5 z-20">
                                    <span className="text-[8px] uppercase font-bold text-white/80 tracking-widest">CAM 01</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 2. Content Area (Social + AI) */}
                <div className="flex-1 min-h-0 p-3 flex flex-col gap-3">
                    <SocialFeed github={socialGithub} twitter={socialTwitter} linkedin={socialLinkedin} />

                    {/* The new AI Avatar Box */}
                    <div className="flex-1 min-h-0">
                        <AICompanion />
                    </div>
                </div>

                {/* 3. Secondary Cams (Toggleable) */}
                <AnimatePresence>
                    {(showHandCam || showRoomCam) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="flex flex-col gap-0 flex-shrink-0 border-t border-white/5"
                        >
                            {showHandCam && (
                                <div className="aspect-video w-full bg-black relative overflow-hidden flex items-center justify-center group border-b border-white/5 last:border-b-0">
                                    <span className="text-[9px] text-white/10 font-bold group-hover:text-white/30 transition-colors">HAND</span>
                                </div>
                            )}
                            {showRoomCam && (
                                <div className="aspect-video w-full bg-black relative overflow-hidden flex items-center justify-center group">
                                    <span className="text-[9px] text-white/10 font-bold group-hover:text-white/30 transition-colors">ROOM</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

// Helper Components
const SettingsComponents = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);

const ToggleItem = ({ label, active, onClick }) => (
    <button onClick={onClick} className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors group">
        <span className="text-xs text-white/70 group-hover:text-white">{label}</span>
        <div className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-blue-500' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${active ? 'left-4.5' : 'left-0.5'}`} style={{ left: active ? '18px' : '2px' }} />
        </div>
    </button>
);

export default OverlayLayout;
