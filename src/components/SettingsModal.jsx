import { motion } from 'framer-motion';
import { Camera, Cloud, Cpu, Download, Loader2, Rocket, Settings, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const SIDECAR_URL = 'http://127.0.0.1:8080';

async function sidecarGet(path) {
    const res = await fetch(`${SIDECAR_URL}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function sidecarPost(path, data = {}) {
    const res = await fetch(`${SIDECAR_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

const SettingsModal = ({
    onClose,
    showFaceCam, setShowFaceCam,
    showHandCam, setShowHandCam,
    showRoomCam, setShowRoomCam,
    socialGithub, setSocialGithub,
    socialTwitter, setSocialTwitter,
    socialLinkedin, setSocialLinkedin,
    useGPU, setUseGPU
}) => {
    const [activeTab, setActiveTab] = useState('layout');

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full max-w-4xl max-h-[85vh] h-[700px] bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                            <Settings size={20} className="text-white/80" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-1 min-h-0">
                    {/* Sidebar */}
                    <div className="w-64 border-r border-white/10 flex flex-col p-4 gap-2 bg-black/20">
                        <TabButton
                            icon={Camera}
                            label="Layout & Cameras"
                            active={activeTab === 'layout'}
                            onClick={() => setActiveTab('layout')}
                        />
                        <TabButton
                            icon={Cpu}
                            label="Local AI Config"
                            active={activeTab === 'ai'}
                            onClick={() => setActiveTab('ai')}
                        />
                    </div>

                    {/* Main Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-black/40 custom-scrollbar">
                        {activeTab === 'layout' && (
                            <LayoutTab
                                showFaceCam={showFaceCam} setShowFaceCam={setShowFaceCam}
                                showHandCam={showHandCam} setShowHandCam={setShowHandCam}
                                showRoomCam={showRoomCam} setShowRoomCam={setShowRoomCam}
                                socialGithub={socialGithub} setSocialGithub={setSocialGithub}
                                socialTwitter={socialTwitter} setSocialTwitter={setSocialTwitter}
                                socialLinkedin={socialLinkedin} setSocialLinkedin={setSocialLinkedin}
                                useGPU={useGPU} setUseGPU={setUseGPU}
                            />
                        )}
                        {activeTab === 'ai' && (
                            <LocalAITab />
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

const TabButton = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${active
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
    >
        <Icon size={18} />
        {label}
    </button>
);

const ToggleItem = ({ label, description, active, onClick }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer" onClick={onClick}>
        <div>
            <div className="text-sm font-medium text-white">{label}</div>
            <div className="text-xs text-white/50 mt-1">{description}</div>
        </div>
        <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ease-in-out ${active ? 'bg-blue-500' : 'bg-white/10'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ease-in-out ${active ? 'left-6' : 'left-1'}`} />
        </div>
    </div>
);

const LayoutTab = ({ showFaceCam, setShowFaceCam, showHandCam, setShowHandCam, showRoomCam, setShowRoomCam, socialGithub, setSocialGithub, socialTwitter, setSocialTwitter, socialLinkedin, setSocialLinkedin, useGPU, setUseGPU }) => {
    const [localGithub, setLocalGithub] = useState(socialGithub || '');
    const [localTwitter, setLocalTwitter] = useState(socialTwitter || '');
    const [localLinkedin, setLocalLinkedin] = useState(socialLinkedin || '');

    useEffect(() => {
        setLocalGithub(socialGithub || '');
        setLocalTwitter(socialTwitter || '');
        setLocalLinkedin(socialLinkedin || '');
    }, [socialGithub, socialTwitter, socialLinkedin]);

    const handleSaveSocials = () => {
        if (localGithub !== socialGithub) setSocialGithub(localGithub);
        if (localTwitter !== socialTwitter) setSocialTwitter(localTwitter);
        if (localLinkedin !== socialLinkedin) setSocialLinkedin(localLinkedin);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h3 className="text-lg font-semibold text-white mb-1">Camera Visibility</h3>
                <p className="text-sm text-white/50 mb-4">Toggle cameras on your overlay on or off.</p>

                <div className="flex flex-col gap-3">
                    <ToggleItem
                        label="Face Camera"
                        description="Shows the primary face camera widget on the top right."
                        active={showFaceCam}
                        onClick={() => setShowFaceCam(!showFaceCam)}
                    />
                    <ToggleItem
                        label="Hand Camera"
                        description="Secondary camera focusing on hands/keyboard."
                        active={showHandCam}
                        onClick={() => setShowHandCam(!showHandCam)}
                    />
                    <ToggleItem
                        label="Room Camera"
                        description="Wide angle camera showing the entire room."
                        active={showRoomCam}
                        onClick={() => setShowRoomCam(!showRoomCam)}
                    />
                </div>
            </div>

            <div className="pt-2">
                <h3 className="text-lg font-semibold text-white mb-1">Social URLs</h3>
                <p className="text-sm text-white/50 mb-4">Set the text for the social feed ticker.</p>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/60 font-medium ml-1">Github URL / Handle</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                            placeholder="/raghu-dev"
                            value={localGithub}
                            onChange={(e) => setLocalGithub(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/60 font-medium ml-1">Twitter Handle</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                            placeholder="@raghu_codes"
                            value={localTwitter}
                            onChange={(e) => setLocalTwitter(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/60 font-medium ml-1">LinkedIn URL</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                            placeholder="/in/raghu"
                            value={localLinkedin}
                            onChange={(e) => setLocalLinkedin(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSaveSocials}
                        className="mt-2 w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/20"
                    >
                        Save Socials
                    </button>
                </div>
            </div>

            <div className="pt-2">
                <h3 className="text-lg font-semibold text-white mb-1">Hardware Settings</h3>
                <p className="text-sm text-white/50 mb-4">Toggle CUDA/Metal hardware GPU acceleration. (Requires server restart)</p>

                <div className="flex flex-col gap-3">
                    <ToggleItem
                        label="Enable GPU Acceleration"
                        description="Routes AI calculations to your GPU for massive generation speeds."
                        active={useGPU}
                        onClick={() => setUseGPU(!useGPU)}
                    />
                </div>
            </div>
        </div >
    );
};

function LocalAITab() {
    const [status, setStatus] = useState(null);
    const [models, setModels] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloadProgress, setDownloadProgress] = useState({});
    const [loadingModel, setLoadingModel] = useState(null);
    const [sidecarAvailable, setSidecarAvailable] = useState(null);

    useEffect(() => {
        let ws = null;
        let mounted = true;

        async function checkSidecar() {
            try {
                const health = await fetch(`${SIDECAR_URL}/health`, { method: 'GET' });
                if (health.ok && mounted) {
                    setSidecarAvailable(true);
                    loadStatus();
                    loadModels();

                    ws = new WebSocket(`ws://127.0.0.1:8080`);
                    ws.onopen = () => {
                        ws.send(JSON.stringify({ type: 'system', client: 'localAITab', payload: 'status-check' }));
                    };
                    ws.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            if (data.type === 'llm-progress' || data.type === 'llm-download-progress') {
                                const { type: progressType, progress, modelName, error: progressError } = data.payload || {};
                                if (progressType === 'download' || data.type === 'llm-download-progress') {
                                    setDownloadProgress(prev => ({ ...prev, [modelName]: progress }));
                                } else if (progressType === 'loading') {
                                    setLoadingModel(modelName);
                                } else if (progressType === 'loaded') {
                                    setLoadingModel(null);
                                    loadStatus();
                                    loadModels();
                                } else if (progressType === 'error') {
                                    setError(progressError || 'Unknown error');
                                    setLoadingModel(null);
                                }
                            } else if (data.type === 'llm-loaded') {
                                setLoadingModel(null);
                                loadStatus();
                                loadModels();
                            } else if (data.type === 'llm-error') {
                                setError(data.payload?.error || 'Unknown error');
                                setLoadingModel(null);
                            }
                        } catch (e) {
                            // Ignore
                        }
                    };
                } else if (mounted) {
                    setSidecarAvailable(false);
                }
            } catch (e) {
                if (mounted) {
                    setSidecarAvailable(false);
                }
            }
        }

        checkSidecar();

        return () => {
            mounted = false;
            if (ws) ws.close();
        };
    }, []);

    const loadStatus = async () => {
        try {
            const s = await sidecarGet('/llm/status');
            setStatus(s);
        } catch (e) {
            setError(e.message);
        }
    };

    const loadModels = async () => {
        setLoading(true);
        try {
            const m = await sidecarGet('/llm/models');
            setModels(m || {});
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (modelName) => {
        setError('');
        setDownloadProgress(prev => ({ ...prev, [modelName]: 0 }));
        try {
            const result = await sidecarPost('/llm/download', { modelName });
            if (result && !result.ok && result.error) {
                setError(result.error || 'Download failed');
            } else {
                loadModels();
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setDownloadProgress(prev => {
                const copy = { ...prev };
                delete copy[modelName];
                return copy;
            });
        }
    };

    const handleLoad = async (modelName) => {
        setError('');
        setLoadingModel(modelName);
        try {
            const result = await sidecarPost('/llm/load', { modelName });
            if (result && !result.ok && result.error) {
                setError(result.error || 'Failed to load model');
            }
            loadStatus();
            loadModels();
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingModel(null);
        }
    };

    const handleUnload = async () => {
        setError('');
        try {
            await sidecarPost('/llm/unload');
            loadStatus();
            loadModels();
        } catch (e) {
            setError(e.message);
        }
    };

    if (sidecarAvailable === null) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-white/50 animate-in fade-in duration-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="text-sm">Connecting to AI service backend...</p>
            </div>
        );
    }

    if (!sidecarAvailable) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-red-500/5 border border-red-500/20 rounded-2xl text-center">
                <Cloud className="w-16 h-16 mb-4 text-white/20" />
                <h3 className="text-lg font-semibold text-white mb-2">Backend Connection Failed</h3>
                <p className="text-sm text-white/60 max-w-md mx-auto">
                    Local AI models require the Node.js backend server.
                    Ensure that `server.js` is actively running.
                </p>
            </div>
        );
    }

    const modelList = Object.entries(models).filter(([k]) => !k.startsWith('error'));

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Card */}
            <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
                <div className="flex items-center gap-4 mb-4 text-sm">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${status?.modelLoaded
                        ? 'bg-gradient-to-br from-green-500 to-green-700'
                        : 'bg-gradient-to-br from-blue-500 to-purple-600'
                        }`}>
                        <Rocket />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-white m-0">
                            Local AI Engine
                        </h3>
                        <div className="text-xs text-white/50 mt-1">
                            {status?.modelLoaded
                                ? `Active: ${status.currentModel?.replace('.gguf', '').replace(/-/g, ' ')}`
                                : status?.initialized
                                    ? 'Ready - No model loaded'
                                    : 'Initializing...'}
                        </div>
                    </div>
                    {status?.modelLoaded && (
                        <button
                            onClick={handleUnload}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 size={14} />
                            Unload
                        </button>
                    )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-black/30 rounded-xl text-center">
                        <div className="text-xl font-bold text-white mb-1">
                            {modelList.filter(([, m]) => m.downloaded).length}
                        </div>
                        <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Downloaded</div>
                    </div>
                    <div className="p-3 bg-black/30 rounded-xl text-center">
                        <div className={`text-xl font-bold mb-1 ${status?.modelLoaded ? 'text-green-400' : 'text-white'}`}>
                            {status?.modelLoaded ? '1' : '0'}
                        </div>
                        <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Active</div>
                    </div>
                    <div className="p-3 bg-black/30 rounded-xl text-center">
                        <div className="text-xl font-bold text-white mb-1">
                            {modelList.length}
                        </div>
                        <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Available</div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div>
                <h4 className="text-sm font-semibold text-white mb-4">
                    Available Models
                </h4>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {modelList.map(([filename, model]) => (
                            <ModelCard
                                key={filename}
                                filename={filename}
                                model={model}
                                isLoaded={status?.currentModel === filename}
                                isLoading={loadingModel === filename}
                                downloadProgress={downloadProgress[filename]}
                                onDownload={() => handleDownload(filename)}
                                onLoad={() => handleLoad(filename)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <strong className="text-blue-400 text-sm mb-2 block">How it works:</strong>
                <ul className="text-xs text-white/70 list-disc pl-5 space-y-1">
                    <li>Models run 100% locally on your device - no internet required</li>
                    <li>Download once, use offline forever</li>
                    <li>Currently connected directly to Node.js backend logic</li>
                    <li>Recommended: Llama-3.2-1B-Instruct for quick responses</li>
                </ul>
            </div>
        </div>
    );
}

function ModelCard({ filename, model, isLoaded, isLoading, downloadProgress, onDownload, onLoad }) {
    const isDownloading = downloadProgress !== undefined;

    const getQualityColor = (quality) => {
        switch (quality?.toLowerCase()) {
            case 'high': return 'bg-green-500/20 text-green-400';
            case 'good': return 'bg-blue-500/20 text-blue-400';
            case 'basic': return 'bg-amber-500/20 text-amber-500';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    return (
        <div className={`p-4 rounded-xl border transition-all ${isLoaded ? 'bg-green-500/10 border-green-500/30' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
            }`}>
            <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-md ${isLoaded
                    ? 'bg-gradient-to-br from-green-400 to-green-600'
                    : model.downloaded
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                        : 'bg-white/10'
                    }`}>
                    {isLoaded ? <Rocket size={20} /> : <Cpu size={20} />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm truncate">
                            {model.name}
                        </span>
                        {isLoaded && (
                            <span className="text-[10px] px-2 py-0.5 rounded backdrop-blur-sm bg-green-500/20 text-green-400 font-bold uppercase tracking-wider">
                                Active
                            </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-semibold tracking-wider ${getQualityColor(model.quality)}`}>
                            {model.quality}
                        </span>
                    </div>

                    <div className="text-xs text-white/50 mb-3 truncate">
                        {model.description}
                    </div>

                    <div className="flex gap-4 text-[11px] text-white/40">
                        <span>Size: <strong className="text-white/60">{model.size}</strong></span>
                        <span>RAM: <strong className="text-white/60">{model.ram}</strong></span>
                        <span>Speed: <strong className="text-white/60">{model.speed}</strong></span>
                    </div>

                    {isDownloading && (
                        <div className="mt-3">
                            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                                    style={{ width: `${downloadProgress}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-blue-400 mt-1.5 font-medium tracking-wide">
                                Downloading... {downloadProgress.toFixed(1)}%
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0">
                    {!model.downloaded ? (
                        <button
                            onClick={onDownload}
                            disabled={isDownloading}
                            className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all shadow-md
                                ${isDownloading
                                    ? 'bg-white/10 text-white/50 cursor-wait'
                                    : 'bg-white text-black hover:bg-white/90'
                                }`}
                        >
                            {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            {isDownloading ? 'Downloading' : 'Download'}
                        </button>
                    ) : isLoaded ? (
                        <div className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold shadow-inner">
                            In Use
                        </div>
                    ) : (
                        <button
                            onClick={onLoad}
                            disabled={isLoading}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all border
                                ${isLoading
                                    ? 'bg-white/5 border-transparent text-white/50 cursor-wait'
                                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                                }`}
                        >
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                            {isLoading ? 'Loading' : 'Load Model'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
