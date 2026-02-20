import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { useOBS } from '../context/OBSContext';
import CurrentTask from './CurrentTask';
import SocialFeed from './SocialFeed';

const OverlayLayout = () => {
    const { isRecording, isConnected } = useOBS();
    const [showFaceCam, setShowFaceCam] = React.useState(true);
    const [showHandCam, setShowHandCam] = React.useState(true);
    const [showRoomCam, setShowRoomCam] = React.useState(true);
    const [showSettings, setShowSettings] = React.useState(false);

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

                {/* Settings Menu */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="absolute top-10 right-0 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl flex flex-col gap-1"
                        >
                            <div className="text-[10px] uppercase font-bold text-white/30 px-2 py-1">Visibility</div>
                            <ToggleItem label="Face Cam" active={showFaceCam} onClick={() => setShowFaceCam(!showFaceCam)} />
                            <ToggleItem label="Hand Cam" active={showHandCam} onClick={() => setShowHandCam(!showHandCam)} />
                            <ToggleItem label="Room Cam" active={showRoomCam} onClick={() => setShowRoomCam(!showRoomCam)} />
                        </motion.div>
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
                <div className="h-40 w-full flex-shrink-0 border-t border-white/5 bg-black/80 backdrop-blur-md relative z-20">
                    <CurrentTask />
                </div>
            </div>


            {/* --- RIGHT COLUMN: SIDEBAR (Fixed Width) --- */}
            <div className="w-80 h-full flex flex-col gap-0 flex-shrink-0 relative z-10 border-l border-white/5 bg-black/40 backdrop-blur-sm transition-all duration-300">

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

                {/* 2. Social Feed (Fills gap logic) */}
                <div className="flex-1 min-h-0 p-3 flex flex-col justify-center">
                    <SocialFeed />
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
