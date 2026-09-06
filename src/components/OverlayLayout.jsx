import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronUp, Circle, Film, GripHorizontal, Layers, LayoutGrid, Pencil, Play, RotateCcw, Save, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRoom, isDefaultRoom, layoutUrl, newRoomId, setRoomInUrl, shareLinks } from '../config.js';
import { track } from '../analytics';
import { useOBS } from '../context/OBSContext';
import AICompanion from './AICompanion';
import BackgroundPanel, { bgToStyle } from './BackgroundPanel';
import CameraEditor from './CameraEditor';
import CurrentTask from './CurrentTask';
import DraggableBox from './DraggableBox';
import ElementEditor from './ElementEditor';
import ElementRenderer, { defaultElement } from './ElementRenderer';
import LayersPanel from './LayersPanel';
import ThemePanel from './ThemePanel';
import CameraFrame, { DEFAULT_CAM_STYLE } from './CameraFrame';
import LayoutGallery from './LayoutGallery';
import { DEFAULT_THEME, getTheme } from '../theme/themes';
import { MOODS } from '../theme/moods';
import { packSnapshot } from '../scenes/packs';
import { STARTER_LAYOUTS, buildStarterLayout } from '../scenes/starterLayouts';

const DEFAULT_BOXES = {
    faceCam: { x: 80, y: 0, w: 20, h: 20 },
    aiCompanion: { x: 80, y: 38, w: 20, h: 37 },
    handCam: { x: 80, y: 75, w: 10, h: 10 },
    roomCam: { x: 90, y: 75, w: 10, h: 10 },
    currentTask: { x: 0, y: 85, w: 80, h: 15 },
};

const CAMERA_IDS = ['faceCam', 'handCam', 'roomCam'];

const elementTitle = (type) => type.charAt(0).toUpperCase() + type.slice(1);

const ElementBox = memo(
    ({
        element, zIndex, selected, editMode, canvasRef, extraStyle, theme, mood,
        onSelect, onBoxChange, onUploadLogo, onElementUpdate,
    }) => {
        const handleUploadLogo = useCallback(() => onUploadLogo(element.id), [element.id, onUploadLogo]);
        const handleUpdate = useCallback((changes) => onElementUpdate?.(element.id, changes), [element.id, onElementUpdate]);

        return (
            <DraggableBox
                id={element.id}
                title={elementTitle(element.type)}
                box={element.box}
                zIndex={zIndex}
                selected={selected}
                onSelect={onSelect}
                onBoxChange={onBoxChange}
                editMode={editMode}
                canvasRef={canvasRef}
                extraStyle={extraStyle}
            >
                <ElementRenderer element={element} editMode={editMode} onUploadLogo={handleUploadLogo} onElementUpdate={handleUpdate} theme={theme} mood={mood} />
            </DraggableBox>
        );
    },
    (prev, next) => (
        prev.element === next.element &&
        prev.zIndex === next.zIndex &&
        prev.selected === next.selected &&
        prev.editMode === next.editMode &&
        prev.canvasRef === next.canvasRef &&
        prev.extraStyle === next.extraStyle &&
        prev.theme === next.theme &&
        prev.mood === next.mood &&
        prev.onSelect === next.onSelect &&
        prev.onBoxChange === next.onBoxChange &&
        prev.onUploadLogo === next.onUploadLogo &&
        prev.onElementUpdate === next.onElementUpdate
    )
);

// Built-ins are now "add on demand": a box is present in the composition only
// when its flag is true. Nothing is active by default — you add components from
// the Layers panel (or by applying a scene).
const DEFAULT_VISIBILITY = {
    faceCam: false,
    handCam: false,
    roomCam: false,
    aiCompanion: false,
    currentTask: false,
};

// Per-session ID to suppress WS echoes of our own updates.
const SESSION_ID = Math.random().toString(36).slice(2);

// Clean / "OBS" mode: when the overlay is loaded as an OBS browser source, add
// ?obs (or ?clean) to the URL to suppress all on-screen controls (the live dock)
// so only the overlay itself is captured. Read once at module load.
const CLEAN_MODE = (() => {
    try {
        const p = new URLSearchParams(window.location.search);
        return p.has('obs') || p.has('clean');
    } catch {
        return false;
    }
})();

// The overlay is designed against a fixed 1920×1080 canvas (OBS's source size);
// element font sizes etc. are px tuned for that. To preview it correctly at any
// viewport (a phone, a small window) we render at that real size and CSS-scale
// the whole canvas to fit — so everything scales uniformly instead of fixed-px
// fonts overflowing tiny %-based boxes.
const BASE_W = 1920;
const BASE_H = 1080;
const useFitScale = () => {
    const get = () => Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
    const [scale, setScale] = useState(get);
    useEffect(() => {
        const on = () => setScale(get());
        window.addEventListener('resize', on);
        window.visualViewport?.addEventListener('resize', on);
        return () => {
            window.removeEventListener('resize', on);
            window.visualViewport?.removeEventListener('resize', on);
        };
    }, []);
    return scale;
};

// True on phone-width / narrow viewports, where the editor's fixed side panels
// (240 + 260 px) can't sit alongside the canvas. In that case the panels become
// overlays (a slide-in drawer + a bottom sheet) instead of eating canvas width.
const useIsNarrow = (bp = 760) => {
    const [narrow, setNarrow] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < bp
    );
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
        const on = () => setNarrow(mq.matches);
        on();
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, [bp]);
    return narrow;
};

const OverlayLayout = () => {
    const { isRecording, isConnected, placeCameras } = useOBS();
    const canvasRef = useRef(null);

    // ── Boxes are separate state so dragging never re-renders the rest of the overlay ──
    const [boxes, setBoxes] = useState(DEFAULT_BOXES);
    const boxesRef = useRef(DEFAULT_BOXES);
    boxesRef.current = boxes;

    const [layoutSettings, setLayoutSettings] = useState({
        showFaceCam: true,
        showHandCam: true,
        showRoomCam: true,
        boxVisibility: DEFAULT_VISIBILITY,
        useGPU: true,
        tasks: [{ id: 1, text: 'Refactoring Overlay', status: 'active' }],
        elements: [],
        background: { type: 'solid', color: '#0a0a0f' },
        theme: DEFAULT_THEME,
        scenes: [],
    });
    // Live mirror of camera visibility for callbacks that auto-place the native
    // OBS camera sources without re-creating on every settings change.
    const visRef = useRef(DEFAULT_VISIBILITY);
    visRef.current = layoutSettings.boxVisibility ?? DEFAULT_VISIBILITY;

    // ── Responsive editor ── on narrow phones the side panels become overlays.
    const isNarrow = useIsNarrow();
    const fitScale = useFitScale();
    const [drawerOpen, setDrawerOpen] = useState(false); // left (layers) drawer on mobile

    const [showBgPanel, setShowBgPanel] = useState(false);
    const [showThemePanel, setShowThemePanel] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [dockScenesOpen, setDockScenesOpen] = useState(false);
    // Live dock can collapse to a tiny handle for a clean view.
    const [dockCollapsed, setDockCollapsed] = useState(false);
    // Brief confirmation after "Go Live" mints/links a room.
    const [liveToast, setLiveToast] = useState(null);
    // When set, the next click/drag on the canvas places a new element of this
    // type (click = default size at point, drag = drawn box). null = off.
    const [placingType, setPlacingType] = useState(null);
    const placePreviewRef = useRef(null);
    const themeRef = useRef(DEFAULT_THEME);
    themeRef.current = layoutSettings.theme ?? DEFAULT_THEME;
    const [editMode, setEditMode] = useState(false);
    // Mirror editMode into a ref so the polling loop can read it without
    // resubscribing. While editing, polled server data must not clobber the
    // local edits you're making.
    const editModeRef = useRef(editMode);
    editModeRef.current = editMode;

    // "Save Scene" is two-step: the header button swaps in-place for a name
    // input + save/cancel, so scenes can be named as they're created.
    const [namingScene, setNamingScene] = useState(false);
    const [sceneNameDraft, setSceneNameDraft] = useState('');
    const [selectedBox, setSelectedBox] = useState(null);
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [zOrder, setZOrder] = useState(Object.keys(DEFAULT_BOXES));

    // Cameras are NOT captured in the browser — the real webcam is a native OBS
    // "Video Capture Device" source. The overlay only renders a styled FRAME
    // placeholder (pure CSS, so it composites into OBS) that you position over
    // the OBS camera source. No getUserMedia → no permission prompt, no webcam
    // spin-up, no video-decode memory growth.

    // ── OBS recording — close edit panels ───────────────────────────────────────
    useEffect(() => {
        if (isRecording) {
            setEditMode(false);
            setSelectedBox(null);
            setSelectedElementId(null);
            setShowBgPanel(false);
        }
    }, [isRecording]);

    // ── Canvas click — deselect ──────────────────────────────────────────────
    const onCanvasPointerDown = useCallback((e) => {
        if (e.target === e.currentTarget) {
            setSelectedBox(null);
            setSelectedElementId(null);
        }
    }, []);

    // ── Element placement: arm a type (handlers defined after addElement) ────
    const armPlace = useCallback((type) => {
        setPlacingType(type);
        setSelectedBox(null);
        setSelectedElementId(null);
    }, []);

    // Escape cancels an armed placement.
    useEffect(() => {
        if (!placingType) return;
        const onKey = (e) => { if (e.key === 'Escape') setPlacingType(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [placingType]);

    // On mobile, picking a layer / selecting a box / arming placement should
    // dismiss the layers drawer so the canvas (and the bottom-sheet editor) show.
    useEffect(() => {
        if (isNarrow && (selectedBox || selectedElementId || placingType)) setDrawerOpen(false);
    }, [isNarrow, selectedBox, selectedElementId, placingType]);

    // ── Stable layout updater (non-box settings only) ───────────────────────
    const updateLayout = useCallback((updates) => {
        setLayoutSettings(s => ({ ...s, ...updates }));
        fetch(layoutUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, _clientId: SESSION_ID }),
        }).catch(console.error);
    }, []);

    // ── Theme ────────────────────────────────────────────────────────────────
    // applyTheme replaces the whole theme (picking a starter); updateTheme
    // patches individual tokens (editing accent / radius / font in the panel).
    const applyTheme = useCallback((theme) => updateLayout({ theme: getTheme(theme) }), [updateLayout]);
    const updateTheme = useCallback((changes) =>
        setLayoutSettings(s => {
            const theme = { ...(s.theme ?? DEFAULT_THEME), ...changes };
            fetch(layoutUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme, _clientId: SESSION_ID }),
            }).catch(console.error);
            return { ...s, theme };
        }), []);

    // ── Stable box updater — only updates boxes state, not layoutSettings ───
    const updateBox = useCallback((id, newBox) => {
        const updated = { ...boxesRef.current, [id]: newBox };
        boxesRef.current = updated;
        setBoxes(updated);
        // Dragging a cam frame also re-pins the native OBS camera source to it.
        if (CAMERA_IDS.includes(id)) placeCameras(updated, visRef.current);
        fetch(layoutUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boxes: updated, _clientId: SESSION_ID }),
        }).catch(console.error);
    }, [placeCameras]);

    const resetLayout = useCallback(() => {
        boxesRef.current = DEFAULT_BOXES;
        setBoxes(DEFAULT_BOXES);
        placeCameras(DEFAULT_BOXES, visRef.current);
        fetch(layoutUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boxes: DEFAULT_BOXES, _clientId: SESSION_ID }),
        }).catch(console.error);
    }, [placeCameras]);

    // ── Scenes ───────────────────────────────────────────────────────────────
    // A scene snapshot = { boxes, boxVisibility, elements, background, zOrder }.
    // Applying replaces the whole visual layout in one shot (and persists it).
    const applyScene = useCallback((snapshot = {}) => {
        const nBoxes = { ...DEFAULT_BOXES, ...(snapshot.boxes ?? {}) };
        const nVis   = { ...DEFAULT_VISIBILITY, ...(snapshot.boxVisibility ?? {}) };
        const nEls   = snapshot.elements ?? [];
        const nBg    = snapshot.background ?? { type: 'solid', color: '#0a0a0f' };
        const nZ     = snapshot.zOrder ?? Object.keys(DEFAULT_BOXES);
        // A scene may carry a theme (theme packs do); otherwise keep the current one.
        const nTheme = snapshot.theme ? getTheme(snapshot.theme) : undefined;
        // Saved layouts (not scenes) additionally carry camera frames.
        const extra = {};
        if (snapshot.camStyles !== undefined) extra.camStyles = snapshot.camStyles;

        boxesRef.current = nBoxes;
        setBoxes(nBoxes);
        setZOrder(nZ);
        setSelectedBox(null);
        setSelectedElementId(null);
        // Snap the native OBS camera sources into this scene's cam frames (and
        // hide them on scenes that don't use a cam). No-op if OBS isn't connected.
        placeCameras(nBoxes, nVis);
        setLayoutSettings(s => ({
            ...s,
            elements: nEls,
            background: nBg,
            boxVisibility: nVis,
            showFaceCam: nVis.faceCam,
            showHandCam: nVis.handCam,
            showRoomCam: nVis.roomCam,
            ...(nTheme ? { theme: nTheme } : {}),
            ...extra,
        }));
        fetch(layoutUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                boxes: nBoxes, elements: nEls, background: nBg, boxVisibility: nVis,
                showFaceCam: nVis.faceCam, showHandCam: nVis.handCam, showRoomCam: nVis.roomCam,
                ...(nTheme ? { theme: nTheme } : {}),
                ...extra,
                _clientId: SESSION_ID,
            }),
        }).catch(console.error);
    }, [placeCameras]);

    // Installing a pack applies its theme + signature scene in one shot.
    const installPack = useCallback((pack) => applyScene(packSnapshot(pack)), [applyScene]);

    // ── Go Live ──────────────────────────────────────────────────────────────
    // Give this session its own private room so multiple users don't collide on
    // the shared `default` slot. On first use it mints a meeting-style id, rewrites
    // the URL, seeds the new slot with the current design (one shallow-merged POST,
    // so the room is born complete), and copies the OBS browser-source link to the
    // clipboard. If already in a room, it just re-copies the link.
    const goLive = useCallback(async () => {
        const fresh = isDefaultRoom();
        if (fresh) {
            setRoomInUrl(newRoomId());
            try {
                await fetch(layoutUrl(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...layoutSettings, boxes: boxesRef.current, zOrder, _clientId: SESSION_ID }),
                });
            } catch (e) { console.error(e); }
        }
        const room = getRoom();
        const links = shareLinks(room);
        let copied = false;
        try { await navigator.clipboard.writeText(links.obs); copied = true; } catch { /* clipboard blocked */ }
        setLiveToast({ room, ...links, fresh, copied });
        setTimeout(() => setLiveToast(null), 7000);

        // The one event that separates "just looking" from "actually using it":
        // minting a fresh room is the real activation moment; re-copying an
        // existing room's link is a returning user, tracked separately.
        track(fresh ? 'go_live' : 'obs_link_copied', { room });
    }, [layoutSettings, zOrder]);

    // ── Layouts → Scenes ─────────────────────────────────────────────────────
    // A LAYOUT is a named container (a "show": e.g. Valorant Stream). It holds
    // many SCENES (Intro / Gameplay / Outro). Each scene is a FULL snapshot of
    // the whole composition, so scenes within a layout can look entirely
    // different. The live canvas = the active scene of the active layout.
    const captureSnapshot = useCallback(() => ({
        boxes: boxesRef.current,
        boxVisibility: layoutSettings.boxVisibility ?? DEFAULT_VISIBILITY,
        elements: layoutSettings.elements ?? [],
        background: layoutSettings.background ?? { type: 'solid', color: '#0a0a0f' },
        zOrder,
        theme: layoutSettings.theme ?? DEFAULT_THEME,
        camStyles: layoutSettings.camStyles ?? {},
    }), [zOrder, layoutSettings]);

    const layouts = layoutSettings.layouts ?? [];
    const activeLayoutId = layoutSettings.activeLayoutId ?? layouts[0]?.id ?? null;
    const activeLayout = layouts.find(l => l.id === activeLayoutId) ?? null;
    const activeScene = activeLayout?.scenes.find(s => s.id === activeLayout.activeSceneId) ?? activeLayout?.scenes[0] ?? null;

    const writeLayouts = useCallback((nextLayouts, extra) =>
        updateLayout({ layouts: nextLayouts, ...(extra || {}) }), [updateLayout]);

    // ── Layout (container) ops ──
    const createLayout = useCallback((name) => {
        const sceneId = `scene_${Date.now()}`;
        const layoutId = `layout_${Date.now()}`;
        const scene = { id: sceneId, name: 'Scene 1', createdAt: Date.now(), snapshot: captureSnapshot() };
        const layout = {
            id: layoutId,
            name: (name || '').trim() || `Layout ${layouts.length + 1}`,
            createdAt: Date.now(),
            scenes: [scene],
            activeSceneId: sceneId,
        };
        writeLayouts([...layouts, layout], { activeLayoutId: layoutId });
    }, [layouts, captureSnapshot, writeLayouts]);

    // Add a ready-made starter layout: build a real container from the template,
    // append it, make it active, and apply its first scene so the canvas updates.
    const addStarterLayout = useCallback((starter) => {
        const layout = buildStarterLayout(starter);
        writeLayouts([...layouts, layout], { activeLayoutId: layout.id });
        const scene = layout.scenes[0];
        if (scene) applyScene(scene.snapshot);
    }, [layouts, writeLayouts, applyScene]);

    const renameLayout = useCallback((id, name) => {
        writeLayouts(layouts.map(l => l.id === id ? { ...l, name: (name || '').trim() || l.name } : l));
    }, [layouts, writeLayouts]);

    const deleteLayout = useCallback((id) => {
        const next = layouts.filter(l => l.id !== id);
        writeLayouts(next, id === activeLayoutId ? { activeLayoutId: next[0]?.id ?? null } : undefined);
    }, [layouts, activeLayoutId, writeLayouts]);

    const switchLayout = useCallback((id) => {
        const l = layouts.find(x => x.id === id);
        if (!l) return;
        updateLayout({ activeLayoutId: id });
        const scene = l.scenes.find(s => s.id === l.activeSceneId) ?? l.scenes[0];
        if (scene) applyScene(scene.snapshot);
    }, [layouts, updateLayout, applyScene]);

    // ── Scene ops (operate on the active layout) ──
    const saveScene = useCallback((name) => {
        const snap = captureSnapshot();
        let next = layouts;
        let layoutId = activeLayoutId;
        if (!activeLayout) {
            // No layout yet — lazily create a Default container.
            layoutId = `layout_${Date.now()}`;
            next = [...layouts, { id: layoutId, name: 'Default', createdAt: Date.now(), scenes: [], activeSceneId: null }];
        }
        const count = (next.find(l => l.id === layoutId)?.scenes.length) || 0;
        const scene = { id: `scene_${Date.now()}`, name: (name || '').trim() || `Scene ${count + 1}`, createdAt: Date.now(), snapshot: snap };
        next = next.map(l => l.id === layoutId ? { ...l, scenes: [...l.scenes, scene], activeSceneId: scene.id } : l);
        writeLayouts(next, { activeLayoutId: layoutId });
    }, [layouts, activeLayout, activeLayoutId, captureSnapshot, writeLayouts]);

    const switchScene = useCallback((sceneId) => {
        if (!activeLayout) return;
        const scene = activeLayout.scenes.find(s => s.id === sceneId);
        writeLayouts(layouts.map(l => l.id === activeLayout.id ? { ...l, activeSceneId: sceneId } : l));
        if (scene) applyScene(scene.snapshot);
    }, [layouts, activeLayout, writeLayouts, applyScene]);

    const updateScene = useCallback((sceneId) => {
        if (!activeLayout) return;
        const snap = captureSnapshot();
        writeLayouts(layouts.map(l => l.id === activeLayout.id
            ? { ...l, scenes: l.scenes.map(s => s.id === sceneId ? { ...s, snapshot: snap, updatedAt: Date.now() } : s) }
            : l));
    }, [layouts, activeLayout, captureSnapshot, writeLayouts]);

    const renameScene = useCallback((sceneId, name) => {
        if (!activeLayout) return;
        writeLayouts(layouts.map(l => l.id === activeLayout.id
            ? { ...l, scenes: l.scenes.map(s => s.id === sceneId ? { ...s, name: (name || '').trim() || s.name } : s) }
            : l));
    }, [layouts, activeLayout, writeLayouts]);

    const deleteScene = useCallback((sceneId) => {
        if (!activeLayout) return;
        writeLayouts(layouts.map(l => l.id === activeLayout.id
            ? {
                ...l,
                scenes: l.scenes.filter(s => s.id !== sceneId),
                activeSceneId: l.activeSceneId === sceneId ? (l.scenes.find(s => s.id !== sceneId)?.id ?? null) : l.activeSceneId,
            }
            : l));
    }, [layouts, activeLayout, writeLayouts]);

    // ── Element helpers ──────────────────────────────────────────────────────
    // `box` (optional) overrides the type's default position/size — used by
    // canvas placement (click = default size at point, drag = drawn box).
    const addElement = useCallback((type, box) => {
        const el = defaultElement(type, themeRef.current);
        if (box) el.box = box;
        setLayoutSettings(s => {
            const newElements = [...(s.elements ?? []), el];
            fetch(layoutUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elements: newElements, _clientId: SESSION_ID }),
            }).catch(console.error);
            return { ...s, elements: newElements };
        });
        setSelectedElementId(el.id);
        setSelectedBox(null);
    }, []);

    // Canvas placement gesture: click = default-size at point, drag = drawn box.
    // Pointer events so tap/drag-to-place works with touch on phones.
    const onPlacePointerDown = useCallback((e) => {
        const type = placingType;
        const canvas = canvasRef.current;
        if (!type || !canvas) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = canvas.getBoundingClientRect();
        const startX = e.clientX, startY = e.clientY;
        let moved = false;
        const preview = placePreviewRef.current;

        const onMove = (ev) => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            moved = true;
            if (preview) {
                preview.style.display = 'block';
                preview.style.left = `${Math.min(startX, ev.clientX) - rect.left}px`;
                preview.style.top = `${Math.min(startY, ev.clientY) - rect.top}px`;
                preview.style.width = `${Math.abs(dx)}px`;
                preview.style.height = `${Math.abs(dy)}px`;
            }
        };

        const onUp = (ev) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            if (preview) preview.style.display = 'none';
            const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

            let box;
            if (moved) {
                // Drag → element fills the drawn rectangle.
                const left = Math.min(startX, ev.clientX) - rect.left;
                const top = Math.min(startY, ev.clientY) - rect.top;
                box = {
                    x: clamp((left / rect.width) * 100, 0, 100),
                    y: clamp((top / rect.height) * 100, 0, 100),
                    w: clamp((Math.abs(ev.clientX - startX) / rect.width) * 100, 4, 100),
                    h: clamp((Math.abs(ev.clientY - startY) / rect.height) * 100, 3, 100),
                };
            } else {
                // Click → default-size element centered on the click point.
                const def = defaultElement(type).box;
                const cx = ((startX - rect.left) / rect.width) * 100;
                const cy = ((startY - rect.top) / rect.height) * 100;
                box = {
                    x: clamp(cx - def.w / 2, 0, 100 - def.w),
                    y: clamp(cy - def.h / 2, 0, 100 - def.h),
                    w: def.w, h: def.h,
                };
            }
            addElement(type, box);
            setPlacingType(null);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, [placingType, addElement]);

    const updateElement = useCallback((id, changes) => {
        setLayoutSettings(s => {
            const newElements = (s.elements ?? []).map(el => el.id === id ? { ...el, ...changes } : el);
            fetch(layoutUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elements: newElements, _clientId: SESSION_ID }),
            }).catch(console.error);
            return { ...s, elements: newElements };
        });
    }, []);

    const deleteElement = useCallback((id) => {
        setLayoutSettings(s => {
            const newElements = (s.elements ?? []).filter(el => el.id !== id);
            fetch(layoutUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elements: newElements, _clientId: SESSION_ID }),
            }).catch(console.error);
            return { ...s, elements: newElements };
        });
        setSelectedElementId(null);
    }, []);

    const toggleElementVisibility = useCallback((id) => {
        setLayoutSettings(s => {
            const el = (s.elements ?? []).find(e => e.id === id);
            if (!el) return s;
            const newElements = (s.elements ?? []).map(e => e.id === id ? { ...e, hidden: !e.hidden } : e);
            return { ...s, elements: newElements };
        });
    }, []);

    const updateElementBox = useCallback((id, box) => updateElement(id, { box }), [updateElement]);

    const selectElement = useCallback((id) => {
        setSelectedElementId(id);
        setSelectedBox(null);
    }, []);

    const onUploadLogo = useCallback((id) => {
        setSelectedElementId(id);
    }, []);

    // ── Box z-order ──────────────────────────────────────────────────────────
    const selectBox = useCallback((id) => {
        setSelectedBox(id);
        setZOrder(prev => [...prev.filter(x => x !== id), id]);
    }, []);

    const layerUp = useCallback((id) => {
        setZOrder(prev => {
            const i = prev.indexOf(id);
            if (i >= prev.length - 1) return prev;
            const next = [...prev];
            [next[i], next[i + 1]] = [next[i + 1], next[i]];
            return next;
        });
    }, []);

    const layerDown = useCallback((id) => {
        setZOrder(prev => {
            const i = prev.indexOf(id);
            if (i <= 0) return prev;
            const next = [...prev];
            [next[i], next[i - 1]] = [next[i - 1], next[i]];
            return next;
        });
    }, []);

    const getZIndex = useCallback((id) => zOrder.indexOf(id) + 10, [zOrder]);

    // ── Visibility helpers ───────────────────────────────────────────────────
    const getBoxVisible = useCallback((id) => {
        return (layoutSettings.boxVisibility ?? DEFAULT_VISIBILITY)[id] ?? true;
    }, [layoutSettings.boxVisibility]);

    // A built-in box is "present" when its visibility flag is true. Adding sets
    // it true (and selects it); removing sets it false (taking it off the
    // canvas and out of the layers list).
    const setBuiltinVisible = useCallback((id, value) => {
        // Adding/removing a cam box also shows/places or hides the matching
        // native OBS camera source.
        if (CAMERA_IDS.includes(id)) placeCameras(boxesRef.current, { ...visRef.current, [id]: value });
        setLayoutSettings(s => {
            const bv = s.boxVisibility ?? DEFAULT_VISIBILITY;
            const updates = { boxVisibility: { ...bv, [id]: value } };
            if (id === 'faceCam') updates.showFaceCam = value;
            if (id === 'handCam') updates.showHandCam = value;
            if (id === 'roomCam') updates.showRoomCam = value;
            fetch(layoutUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...updates, _clientId: SESSION_ID }),
            }).catch(console.error);
            return { ...s, ...updates };
        });
    }, [placeCameras]);

    const addBuiltin = useCallback((id) => {
        setBuiltinVisible(id, true);
        selectBox(id); // also brings it to the front of the z-order
    }, [setBuiltinVisible, selectBox]);

    const removeBuiltin = useCallback((id) => {
        setBuiltinVisible(id, false);
        setSelectedBox(prev => (prev === id ? null : prev));
    }, [setBuiltinVisible]);

    // Reorder a custom element within the stack. Earlier in the array renders on
    // top (see zIndex below), so "up" = toward the front / top of the list.
    const moveElement = useCallback((id, dir) => {
        setLayoutSettings(s => {
            const els = s.elements ?? [];
            const i = els.findIndex(e => e.id === id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= els.length) return s;
            const next = [...els];
            [next[i], next[j]] = [next[j], next[i]];
            fetch(layoutUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elements: next, _clientId: SESSION_ID }),
            }).catch(console.error);
            return { ...s, elements: next };
        });
    }, []);
    const elementUp = useCallback((id) => moveElement(id, -1), [moveElement]);
    const elementDown = useCallback((id) => moveElement(id, +1), [moveElement]);

    // Per-camera frame styling (frame preset, accent, corner radius).
    const updateCamStyle = useCallback((slot, changes) => {
        setLayoutSettings(s => {
            const cur = s.camStyles ?? {};
            const next = { ...cur, [slot]: { ...DEFAULT_CAM_STYLE, ...(cur[slot] ?? {}), ...changes } };
            fetch(layoutUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ camStyles: next, _clientId: SESSION_ID }),
            }).catch(console.error);
            return { ...s, camStyles: next };
        });
    }, []);

    // ── Hosted layout sync (adaptive polling) ────────────────────────────────
    // The design lives in the hosted /api store; viewers (OBS) pull it by
    // polling — no WebSocket. To avoid hammering the backend (and burning KV
    // quota), the loop is adaptive: it polls quickly right after a change, then
    // backs off to a slow cadence when the layout is unchanged, and pauses
    // entirely while you're editing or the tab is hidden. It also short-circuits
    // re-renders when the fetched payload is identical to the last one.
    const POLL_FAST = 3000;   // ms — recently changed / just became visible
    const POLL_SLOW = 20000;  // ms — settled, nothing changing
    const POLL_MISSES_TO_SLOW = 3;
    useEffect(() => {
        let isMounted = true;
        let timer;
        let lastSig = null;   // signature of the last applied payload
        let misses = 0;       // consecutive unchanged polls

        const applyData = (data) => {
            if (!isMounted || !data || typeof data !== 'object') return;
            if (data.boxes) {
                const newBoxes = { ...DEFAULT_BOXES, ...data.boxes };
                boxesRef.current = newBoxes;
                setBoxes(newBoxes);
            }
            const { boxes: _b, ...rest } = data;
            setLayoutSettings(s => ({
                ...s,
                ...rest,
                boxVisibility: {
                    ...DEFAULT_VISIBILITY,
                    // Honor legacy show* flags only when explicitly present —
                    // an empty slot stays all-false (nothing active by default).
                    ...(data.showFaceCam !== undefined ? { faceCam: data.showFaceCam } : {}),
                    ...(data.showHandCam !== undefined ? { handCam: data.showHandCam } : {}),
                    ...(data.showRoomCam !== undefined ? { roomCam: data.showRoomCam } : {}),
                    ...(data.boxVisibility ?? {}),
                },
            }));
        };

        const tick = async (force) => {
            if (!isMounted) return;
            // Don't poll while editing (we're the writer) or when the tab is
            // hidden (e.g. a backgrounded editor) — except a forced first load.
            const skip = !force && (editModeRef.current || document.hidden);
            if (!skip) {
                try {
                    const res = await fetch(layoutUrl());
                    if (res.ok) {
                        const data = await res.json();
                        const sig = JSON.stringify(data);
                        if (sig !== lastSig) {
                            lastSig = sig;
                            misses = 0;
                            applyData(data);
                        } else {
                            misses++;
                        }
                    }
                } catch { /* offline / transient — try again next tick */ }
            }
            if (!isMounted) return;
            const delay = misses >= POLL_MISSES_TO_SLOW ? POLL_SLOW : POLL_FAST;
            timer = setTimeout(tick, delay);
        };

        // Poll promptly again whenever the tab regains focus.
        const onVisible = () => {
            if (document.hidden) return;
            misses = 0;
            clearTimeout(timer);
            tick();
        };
        document.addEventListener('visibilitychange', onVisible);

        tick(true); // initial load (even if mounted in edit mode)

        return () => {
            isMounted = false;
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    // ── Derived state ────────────────────────────────────────────────────────
    const {
        showFaceCam, showHandCam, showRoomCam,
        useGPU, tasks = [], elements = [],
        background, boxVisibility = DEFAULT_VISIBILITY,
        theme = DEFAULT_THEME,
    } = layoutSettings;

    const selectedElement = elements.find(el => el.id === selectedElementId) ?? null;
    const selectedCamera = CAMERA_IDS.includes(selectedBox) ? selectedBox : null;
    const rightPanelOpen = !!selectedElement || !!selectedCamera;

    const shouldRenderBox = (id) => getBoxVisible(id);

    // ── Live mood ── one source of truth the mood-ring and the pet both read.
    // The ring element holds the manual mood + auto-cycle settings; when auto is
    // on we advance through MOODS on a timer. Pets placed anywhere mirror it.
    const moodRingEl = elements.find(e => e.type === 'moodring' && !e.hidden);
    const moodAuto = !!moodRingEl?.auto;
    const moodCycleSec = Math.max(3, moodRingEl?.cycleSec ?? 20);
    const moodManual = moodRingEl?.mood ?? 'chill';
    const [moodTick, setMoodTick] = useState(0);
    useEffect(() => {
        if (!moodAuto) return;
        // A manual pick mid-cycle restarts the timer so the chosen mood gets a
        // full interval before auto-cycle advances past it.
        setMoodTick(0);
        const id = setInterval(() => setMoodTick(t => t + 1), moodCycleSec * 1000);
        return () => clearInterval(id);
    }, [moodAuto, moodCycleSec, moodManual]);
    // Auto-cycle walks MOODS starting from the manually picked mood, so picking
    // a mood applies immediately even while auto is on.
    const moodBaseIdx = Math.max(0, MOODS.findIndex(m => m.id === moodManual));
    const currentMood = moodAuto ? MOODS[(moodBaseIdx + moodTick) % MOODS.length].id : moodManual;

    // ── Stable callbacks for tasks ───────────────────────────────────────────
    const onTasksChange = useCallback((t) => updateLayout({ tasks: t }), [updateLayout]);

    // ── Memoised DraggableBox children — prevents re-renders on box drag ─────
    // Each child only re-creates when its own data changes (stream, social info, etc.)
    const camStyles = layoutSettings.camStyles ?? {};
    // The frame (border/glow) is CSS and renders in OBS. The CENTER is a
    // placeholder: in the editor it shows a label so you can position the box;
    // in live/OBS mode it's fully transparent so the native OBS webcam shows
    // through the frame.
    const framedCam = (slot, label, showLabel) => {
        const cs = camStyles[slot] ?? DEFAULT_CAM_STYLE;
        return (
            <CameraFrame frame={cs.frame} radius={cs.radius} accent={cs.accent ?? theme.accent} accent2={cs.accent2 ?? theme.accent2}>
                <div style={{
                    width: '100%', height: '100%', boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: showLabel ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: showLabel ? '1px dashed rgba(255,255,255,0.18)' : 'none',
                }}>
                    {showLabel && (
                        <div style={{ textAlign: 'center', pointerEvents: 'none', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{label}</div>
                            <div style={{ fontSize: 8, marginTop: 3, color: 'rgba(255,255,255,0.4)' }}>OBS source</div>
                        </div>
                    )}
                </div>
            </CameraFrame>
        );
    };
    const faceCamChild = useMemo(() => framedCam('faceCam', 'CAM 01', editMode), [editMode, camStyles.faceCam, theme.accent, theme.accent2]);
    const handCamChild = useMemo(() => framedCam('handCam', 'HAND', editMode), [editMode, camStyles.handCam, theme.accent, theme.accent2]);
    const roomCamChild = useMemo(() => framedCam('roomCam', 'ROOM', editMode), [editMode, camStyles.roomCam, theme.accent, theme.accent2]);
    const aiCompanionChild = useMemo(() => (
        <div className="w-full h-full overflow-hidden"><AICompanion /></div>
    ), []);
    const currentTaskChild = useMemo(() => (
        <div className="w-full h-full bg-black/80 backdrop-blur-md border-t border-white/5 overflow-hidden">
            <CurrentTask tasks={tasks} onTasksChange={onTasksChange} />
        </div>
    ), [tasks, onTasksChange]);

    // In edit mode the canvas is a 16:9 preview inside the editor shell.
    // In live mode the canvas is position:absolute filling the viewport.
    // canvasRef always points to the same DOM node so video streams survive the toggle.
    const inEditor = editMode && !isRecording;
    const canvasBg = (!background || background.type === 'transparent')
        ? (inEditor ? {
            backgroundImage: 'linear-gradient(45deg,#1a1a1a 25%,transparent 25%),linear-gradient(-45deg,#1a1a1a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1a1a 75%),linear-gradient(-45deg,transparent 75%,#1a1a1a 75%)',
            backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0px', backgroundColor: '#111',
          } : {})
        : bgToStyle(background);
    const editorWorkspaceBg = inEditor && background && background.type !== 'transparent'
        ? bgToStyle(background)
        : { background: '#050510' };
    // Live preview in a normal browser (phone/desktop) — NOT the OBS source.
    // OBS sizes its browser source to 16:9, so there we fill inset:0. Everywhere
    // else (e.g. a phone in portrait, or a non-16:9 window) we letterbox the
    // canvas to 16:9 so the %-based overlay doesn't stretch.
    const livePreview = !inEditor && !isRecording && !CLEAN_MODE;

    // In live preview the canvas is letterboxed, leaving bars on the sides/top.
    // To avoid a visible seam between the bars and the canvas, paint the scene
    // background on the ROOT (full viewport) and keep the scaled canvas itself
    // transparent — one continuous backdrop. (OBS keeps bg on the canvas so the
    // source stays correctly sized/transparent.)
    const livePreviewBg = (!background || background.type === 'transparent')
        ? { background: '#050510' }
        : bgToStyle(background);
    const activeCanvasBg = inEditor ? {} : (livePreview ? {} : canvasBg);

    return (
        <div style={{
            width: '100vw', height: '100dvh', overflow: 'hidden', position: 'relative',
            ...(inEditor ? { background: '#0a0a12' } : livePreview ? livePreviewBg : { background: 'transparent' }),
        }}>
            {/* OBS recording flash */}
            {isRecording && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.2, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,1)', pointerEvents: 'none', zIndex: 0 }}
                />
            )}

            {/* ── EDITOR CHROME — header + panels, hidden in live / OBS mode ── */}
            {inEditor && (<>
                {/* Header bar */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 40, zIndex: 400,
                    background: 'rgba(8,8,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 12px 0 10px',
                }}>
                    {/* Left: layers toggle (mobile) + logo + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isNarrow && (
                            <button
                                onClick={() => setDrawerOpen(o => !o)}
                                title="Layers & sources"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                    height: 26, padding: '0 9px', flexShrink: 0, cursor: 'pointer',
                                    borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)',
                                    background: drawerOpen ? 'rgba(79,70,229,0.4)' : 'rgba(99,102,241,0.16)',
                                    color: '#c7d2fe', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1,
                                }}
                            >
                                <Layers size={13} />Layers
                            </button>
                        )}
                        <a href="/" title="Home" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                            <div style={{
                                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.45)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#a5b4fc',
                            }}><Circle size={8} fill="#a5b4fc" strokeWidth={0} /></div>
                            {!isNarrow && (
                                <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 3, color: 'rgba(255,255,255,0.45)' }}>
                                    Overlay Studio
                                </span>
                            )}
                        </a>
                    </div>
                    {/* Right: actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {namingScene ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                    autoFocus
                                    value={sceneNameDraft}
                                    onChange={(e) => setSceneNameDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { saveScene(sceneNameDraft); setNamingScene(false); }
                                        if (e.key === 'Escape') setNamingScene(false);
                                    }}
                                    placeholder={`Scene ${(activeLayout?.scenes.length ?? 0) + 1}`}
                                    style={{
                                        width: 130, height: 22, padding: '0 8px', borderRadius: 5,
                                        border: '1px solid rgba(99,102,241,0.45)', background: 'rgba(99,102,241,0.12)',
                                        color: '#e0e7ff', fontSize: 10, fontFamily: 'monospace', outline: 'none',
                                    }}
                                />
                                <HdrBtn active onClick={() => { saveScene(sceneNameDraft); setNamingScene(false); }}>
                                    <Check size={12} style={{ marginRight: 4 }} />Save
                                </HdrBtn>
                                <HdrBtn onClick={() => setNamingScene(false)}><X size={12} /></HdrBtn>
                            </div>
                        ) : (
                            <HdrBtn onClick={() => { setSceneNameDraft(''); setNamingScene(true); }}><Save size={12} style={{ marginRight: 4 }} />Save Scene</HdrBtn>
                        )}
                        <HdrBtn onClick={resetLayout}><RotateCcw size={12} style={{ marginRight: 4 }} />Reset</HdrBtn>
                        <HdrSep />
                        <button
                            onClick={() => { setEditMode(false); setSelectedBox(null); setSelectedElementId(null); setShowBgPanel(false); }}
                            style={{ padding: '3px 12px', borderRadius: 5, fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1, border: '1px solid rgba(99,102,241,0.45)', background: 'rgba(79,70,229,0.4)', color: '#fff', cursor: 'pointer' }}
                        ><Check size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Done</button>
                    </div>
                </div>

                {/* Mobile drawer backdrop — tap to dismiss the layers panel */}
                {isNarrow && drawerOpen && (
                    <div
                        onClick={() => setDrawerOpen(false)}
                        style={{ position: 'absolute', inset: 0, top: 40, zIndex: 350, background: 'rgba(0,0,0,0.5)' }}
                    />
                )}

                {/* Left panel: layers + sources — fixed sidebar on desktop, slide-in drawer on phones */}
                <div style={{
                    position: 'absolute', top: 40, left: 0, bottom: 0, zIndex: isNarrow ? 360 : 300,
                    background: 'rgba(7,7,16,0.98)', borderRight: '1px solid rgba(255,255,255,0.07)',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    ...(isNarrow ? {
                        width: 'min(280px, 85vw)',
                        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
                        transition: 'transform 0.22s ease',
                        boxShadow: drawerOpen ? '8px 0 40px rgba(0,0,0,0.6)' : 'none',
                    } : { width: 240 }),
                }}>
                    <LayersPanel
                        boxVisibility={boxVisibility}
                        onAddBuiltin={addBuiltin}
                        onRemoveBuiltin={removeBuiltin}
                        elements={elements}
                        selectedElementId={selectedElementId}
                        selectedBox={selectedBox}
                        onToggleElement={toggleElementVisibility}
                        onDeleteElement={deleteElement}
                        onElementUp={elementUp}
                        onElementDown={elementDown}
                        onSelectElement={selectElement}
                        onSelectBox={selectBox}
                        onAddElement={addElement}
                        onPlaceElement={armPlace}
                        layoutName={activeLayout?.name ?? null}
                        scenes={activeLayout?.scenes ?? []}
                        activeSceneId={activeLayout?.activeSceneId ?? null}
                        onSwitchScene={switchScene}
                        onSaveScene={saveScene}
                        onUpdateScene={updateScene}
                        onRenameScene={renameScene}
                        onDeleteScene={deleteScene}
                        onOpenLayouts={() => setShowGallery(true)}
                        onOpenBackground={() => { setShowBgPanel(v => !v); setShowThemePanel(false); }}
                        onOpenTheme={() => { setShowThemePanel(v => !v); setShowBgPanel(false); }}
                        onResetLayout={resetLayout}
                        zOrder={zOrder}
                        onLayerUp={layerUp}
                        onLayerDown={layerDown}
                    />
                </div>

                {/* Right panel: element editor or camera picker — sidebar on desktop, bottom sheet on phones */}
                {rightPanelOpen && (
                    <div style={{
                        position: 'absolute', zIndex: isNarrow ? 360 : 300,
                        background: 'rgba(7,7,16,0.98)', overflow: 'auto',
                        ...(isNarrow ? {
                            left: 0, right: 0, bottom: 0, top: 'auto', maxHeight: '58vh',
                            borderTop: '1px solid rgba(99,102,241,0.3)',
                            borderTopLeftRadius: 14, borderTopRightRadius: 14,
                            boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
                        } : {
                            top: 40, right: 0, bottom: 0, width: 260,
                            borderLeft: '1px solid rgba(255,255,255,0.07)',
                        }),
                    }}>
                        {isNarrow && (
                            <div style={{
                                position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 12px', background: 'rgba(7,7,16,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto' }} />
                                <button
                                    onClick={() => { setSelectedElementId(null); setSelectedBox(null); }}
                                    title="Close"
                                    style={{ position: 'absolute', right: 8, top: 6, padding: 4, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                        {selectedElement ? (
                            <ElementEditor
                                element={selectedElement}
                                onChange={(changes) => updateElement(selectedElement.id, changes)}
                                onDelete={() => deleteElement(selectedElement.id)}
                            />
                        ) : (
                            <CameraEditor
                                slot={selectedCamera}
                                camStyle={{ ...DEFAULT_CAM_STYLE, accent: theme.accent, ...(camStyles[selectedCamera] ?? {}) }}
                                onChangeCamStyle={(changes) => updateCamStyle(selectedCamera, changes)}
                            />
                        )}
                    </div>
                )}

                {/* Background panel */}
                {showBgPanel && (
                    <BackgroundPanel
                        bg={background}
                        onChange={(newBg) => updateLayout({ background: newBg })}
                        onClose={() => setShowBgPanel(false)}
                    />
                )}

                {/* Theme panel */}
                {showThemePanel && (
                    <ThemePanel
                        theme={theme}
                        onApply={applyTheme}
                        onChange={updateTheme}
                        onInstallPack={installPack}
                        onClose={() => setShowThemePanel(false)}
                    />
                )}
            </>)}

            {/* ── CANVAS POSITIONING WRAPPER ── */}
            {/* In editor: offset by header + left/right panels, canvas is 16:9 preview */}
            {/* In live:   fills the entire viewport absolutely */}
            <div style={{
                position: 'absolute',
                top:    inEditor ? 40 : 0,
                // On phones the panels float over the canvas, so it spans full width.
                left:   inEditor && !isNarrow ? 240 : 0,
                right:  inEditor && !isNarrow ? (rightPanelOpen ? 260 : 0) : 0,
                bottom: 0,
                overflow: inEditor ? 'auto' : undefined,
                padding: inEditor ? (isNarrow ? 8 : 16) : 0,
                boxSizing: 'border-box',
                ...(inEditor ? editorWorkspaceBg : { background: 'transparent' }),
            }}>
                {/* Dot-grid backdrop */}
                {inEditor && (
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        backgroundImage: 'radial-gradient(rgba(99,102,241,0.10) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                    }} />
                )}
                {/* ── THE CANVAS ──
                    Live mode  → position:absolute filling the viewport (OBS sees this).
                    Editor mode → fills content area of wrapper (16px padding on each side),
                                  height from aspect-ratio so 16:9 is always maintained.
                    The 16px padding ensures resize handles at canvas edges stay reachable.
                */}
                <div
                    ref={canvasRef}
                    onPointerDown={onCanvasPointerDown}
                    className={`font-inter overflow-hidden ${isRecording ? 'outline outline-4 outline-red-500/50' : ''}`}
                    style={{
                        isolation: 'isolate', // required for Element Capture (RestrictionTarget)
                        ...(inEditor ? {
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '16 / 9',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
                        } : livePreview ? {
                            // Render at the real 1920×1080 size and scale-to-fit so
                            // every element matches its OBS proportions (fixed-px
                            // fonts don't overflow tiny %-boxes). Centered, letterboxed.
                            position: 'absolute',
                            top: '50%', left: '50%',
                            width: BASE_W, height: BASE_H,
                            transform: `translate(-50%, -50%) scale(${fitScale})`,
                            transformOrigin: 'center center',
                        } : {
                            position: 'absolute',
                            inset: 0,
                        }),
                        ...activeCanvasBg,
                    }}
                >
                    {/* ── Custom elements ── */}
                    {elements.map((el, i) => {
                        if (el.hidden) return null;
                        return (
                            <ElementBox
                                key={el.id}
                                element={el}
                                zIndex={100 + (elements.length - 1 - i) + (selectedElementId === el.id ? 50 : 0)}
                                selected={selectedElementId === el.id}
                                onSelect={selectElement}
                                onBoxChange={updateElementBox}
                                onUploadLogo={onUploadLogo}
                                onElementUpdate={updateElement}
                                editMode={editMode}
                                canvasRef={canvasRef}
                                theme={theme}
                                mood={currentMood}
                            />
                        );
                    })}

                    {shouldRenderBox('faceCam') && <DraggableBox id="faceCam" title="Face Cam" box={boxes.faceCam} zIndex={getZIndex('faceCam')} selected={selectedBox === 'faceCam'} onSelect={selectBox} onLayerUp={layerUp} onLayerDown={layerDown} onBoxChange={updateBox} editMode={editMode} canvasRef={canvasRef}>{faceCamChild}</DraggableBox>}
                    {shouldRenderBox('aiCompanion') && <DraggableBox id="aiCompanion" title="AI Companion" box={boxes.aiCompanion} zIndex={getZIndex('aiCompanion')} selected={selectedBox === 'aiCompanion'} onSelect={selectBox} onLayerUp={layerUp} onLayerDown={layerDown} onBoxChange={updateBox} editMode={editMode} canvasRef={canvasRef}>{aiCompanionChild}</DraggableBox>}
                    {shouldRenderBox('handCam') && <DraggableBox id="handCam" title="Hand Cam" box={boxes.handCam} zIndex={getZIndex('handCam')} selected={selectedBox === 'handCam'} onSelect={selectBox} onLayerUp={layerUp} onLayerDown={layerDown} onBoxChange={updateBox} editMode={editMode} canvasRef={canvasRef}>{handCamChild}</DraggableBox>}
                    {shouldRenderBox('roomCam') && <DraggableBox id="roomCam" title="Room Cam" box={boxes.roomCam} zIndex={getZIndex('roomCam')} selected={selectedBox === 'roomCam'} onSelect={selectBox} onLayerUp={layerUp} onLayerDown={layerDown} onBoxChange={updateBox} editMode={editMode} canvasRef={canvasRef}>{roomCamChild}</DraggableBox>}
                    {shouldRenderBox('currentTask') && <DraggableBox id="currentTask" title="Current Task" box={boxes.currentTask} zIndex={getZIndex('currentTask')} selected={selectedBox === 'currentTask'} onSelect={selectBox} onLayerUp={layerUp} onLayerDown={layerDown} onBoxChange={updateBox} editMode={editMode} canvasRef={canvasRef}>{currentTaskChild}</DraggableBox>}

                    {/* ── Placement layer — click to drop / drag to draw a new element ── */}
                    {inEditor && placingType && (
                        <div
                            onPointerDown={onPlacePointerDown}
                            onContextMenu={(e) => { e.preventDefault(); setPlacingType(null); }}
                            style={{ position: 'absolute', inset: 0, zIndex: 500, cursor: 'crosshair', touchAction: 'none' }}
                        >
                            <div ref={placePreviewRef} style={{
                                position: 'absolute', display: 'none', pointerEvents: 'none',
                                border: '1px dashed rgba(165,180,252,0.9)', background: 'rgba(99,102,241,0.15)', borderRadius: 4,
                            }} />
                            <div style={{
                                position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
                                background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8,
                                padding: '5px 12px', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1,
                                color: '#a5b4fc', whiteSpace: 'nowrap',
                            }}>
                                Click or drag to place {placingType} · Esc to cancel
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── LIVE MODE DOCK — minimal pill; hidden while recording or in ?obs clean mode ── */}
            {!editMode && !isRecording && !CLEAN_MODE && (
                <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
                    {dockCollapsed ? (
                        <button
                            onClick={() => setDockCollapsed(false)}
                            title="Show controls"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 18, padding: 0, cursor: 'pointer', background: 'rgba(6,6,16,0.7)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: 'rgba(255,255,255,0.4)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.background = 'rgba(6,6,16,0.92)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(6,6,16,0.7)'; }}
                        >
                            <GripHorizontal size={14} />
                        </button>
                    ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? 3 : 2, background: 'rgba(6,6,16,0.88)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: isNarrow ? '6px 8px' : '5px 7px', boxShadow: '0 8px 40px rgba(0,0,0,0.72)', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 24px)' }}>
                        {/* Scene switcher — change scene without entering edit mode */}
                        {activeLayout && activeLayout.scenes.length > 0 && (
                            <div style={{ position: 'relative' }}>
                                <DockBtn active={dockScenesOpen} onClick={() => setDockScenesOpen(o => !o)} title="Switch scene">
                                    <Film size={12} style={{ marginRight: isNarrow ? 0 : 4 }} />
                                    {!isNarrow && (activeScene?.name ?? 'Scene')}
                                    <ChevronUp size={11} style={{ marginLeft: isNarrow ? 1 : 4, transform: dockScenesOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s', opacity: 0.6 }} />
                                </DockBtn>
                                <AnimatePresence>
                                    {dockScenesOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            transition={{ duration: 0.14 }}
                                            style={{
                                                position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, minWidth: 168,
                                                background: 'rgba(6,6,16,0.96)', backdropFilter: 'blur(24px)',
                                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 5,
                                                boxShadow: '0 8px 40px rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', gap: 1,
                                            }}
                                        >
                                            {activeLayout.scenes.map(s => {
                                                const isActive = s.id === activeLayout.activeSceneId;
                                                return (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => { switchScene(s.id); setDockScenesOpen(false); }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 6,
                                                            background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent', border: 'none', cursor: 'pointer',
                                                            color: 'rgba(255,255,255,0.85)', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase',
                                                            letterSpacing: 1, textAlign: 'left', whiteSpace: 'nowrap',
                                                        }}
                                                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#818cf8' : '#64748b', flexShrink: 0 }} />
                                                        <span style={{ flex: 1 }}>{s.name}</span>
                                                        {isActive && <Check size={11} color="#a5b4fc" />}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                        {activeLayout && activeLayout.scenes.length > 0 && <HdrSep />}
                        <DockBtn onClick={() => setShowGallery(true)} title="Browse & switch saved layouts">
                            <LayoutGrid size={12} style={{ marginRight: isNarrow ? 0 : 4 }} />{!isNarrow && 'Layouts'}
                        </DockBtn>
                        <HdrSep />
                        <DockBtn onClick={() => setEditMode(true)} title="Edit layout">
                            {isNarrow ? <Pencil size={12} /> : 'Edit Layout'}
                        </DockBtn>
                        <HdrSep />
                        <DockBtn onClick={goLive} active={!isDefaultRoom()} title={isDefaultRoom() ? 'Go Live — create a private room & copy the OBS link' : `Live in room ${getRoom()} — copy the OBS link again`}>
                            <Play size={12} style={{ marginRight: 4 }} />{isDefaultRoom() ? 'Go Live' : 'Copy Link'}
                        </DockBtn>
                        <DockBtn onClick={() => setDockCollapsed(true)} title="Hide controls for a clean view">
                            <ChevronUp size={12} style={{ transform: 'rotate(180deg)' }} />
                        </DockBtn>
                    </div>
                    )}
                </div>
            )}

            {/* Go Live confirmation toast — bottom-center, above the dock */}
            <AnimatePresence>
                {liveToast && !CLEAN_MODE && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.18 }}
                        style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 400, maxWidth: 380, background: 'rgba(6,6,16,0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 40px rgba(0,0,0,0.72)', color: 'rgba(255,255,255,0.9)', fontFamily: 'monospace' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#a5b4fc' }}>
                            <Check size={13} />{liveToast.fresh ? 'Room created' : 'Live'} · {liveToast.room}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 10.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.6)' }}>
                            {liveToast.copied ? 'OBS link copied to clipboard.' : 'Copy the OBS link below.'} Paste it into OBS as a Browser Source.
                        </div>
                        <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: 'rgba(255,255,255,0.8)', wordBreak: 'break-all', userSelect: 'all' }}>
                            {liveToast.obs}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Layouts gallery (the show/collection switcher) — both modes */}
            {showGallery && (
                <LayoutGallery
                    layouts={layouts}
                    activeLayoutId={activeLayoutId}
                    starters={STARTER_LAYOUTS}
                    onAddStarter={(s) => { addStarterLayout(s); setShowGallery(false); }}
                    onClose={() => setShowGallery(false)}
                    onCreate={createLayout}
                    onSwitch={(id) => { switchLayout(id); setShowGallery(false); }}
                    onRename={renameLayout}
                    onDelete={deleteLayout}
                />
            )}
        </div>
    );
};

const HdrBtn = ({ children, active, icon, onClick }) => (
    <button onClick={onClick} style={{ padding: icon ? '3px 6px' : '3px 9px', borderRadius: 5, fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1, border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.1s', ...(active ? { background: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc' } : { background: 'transparent', borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.38)' }) }}>
        {children}
    </button>
);

const HdrSep = () => <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />;

const DockBtn = ({ children, active, icon, disabled, onClick, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        style={{
            padding: icon ? '4px 7px' : '4px 10px',
            borderRadius: 8,
            fontSize: 9,
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: 1,
            border: '1px solid',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
            transition: 'all 0.12s',
            display: 'flex', alignItems: 'center', gap: 4,
            lineHeight: 1,
            ...(active
                ? { background: 'rgba(79,70,229,0.52)', borderColor: 'rgba(99,102,241,0.5)', color: '#fff' }
                : { background: 'transparent', borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
            ),
        }}
    >
        {children}
    </button>
);

export default OverlayLayout;
