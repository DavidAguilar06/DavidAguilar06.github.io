import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getDatabase, ref, set, update, get,
    onValue, onDisconnect, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey:            "KEY",
    authDomain:        "gato-4f1c3.firebaseapp.com",
    databaseURL:       "https://gato-4f1c3-default-rtdb.firebaseio.com/",
    projectId:         "gato-4f1c3",
    storageBucket:     "gato-4f1c3.firebasestorage.app",
    messagingSenderId: "5901086131",
    appId:             "1:5901086131:web:9eef46fd8044f7cfcbafc6"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);


const FILAS = 6, COLS = 8, PW = 90, PH = 74;
const TAB   = 0.22;
const M     = Math.ceil(Math.max(PW, PH) * TAB) + 6;
const PAD   = 210;
const IMG_W = PW * COLS;
const IMG_H = PH * FILAS;
const AW    = IMG_W + PAD * 2;
const AH    = IMG_H + PAD * 2;
const SNAP  = 18;
const DEF_URL = 'https://wallpapers.com/images/featured/paisajes-2iz0murq98x75o3c.webp';
const PROXY   = 'https://corsproxy.io/?url=';
const COLORES = ['#f87171','#60a5fa','#4ade80','#fbbf24','#e879f9','#38bdf8','#fb923c','#a78bfa'];


let uid, salaId, miColor;
let imagenCanvas  = null;
let imgUrlActual  = '';
let tabsH = [], tabsV = [];
let orden      = [];
let posiciones = {};
let colocadas  = new Set();
let jugadores  = {};
let arrastre   = null
let fantasma   = null;
let unsubs     = [];
let ultimoCursor  = {x: 0, y: 0};
let cursorThrottle = 0;
let zCounter   = 100;


const lobbyEl      = document.getElementById('lobby');
const mainEl       = document.querySelector('.main-content');
const tableroEl    = document.getElementById('tablero');
const areaJuego    = document.getElementById('area-juego');
const cursoresEl   = document.getElementById('cursores');
const miniCv       = document.getElementById('miniatura-canvas');
const loadingEl    = document.getElementById('loading');
const loadingMsg   = document.getElementById('loading-msg');
const toastEl      = document.getElementById('toast');


const r = path => ref(db, path);

function toast(msg, dur = 2200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), dur);
}

function codigoAleatorio() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function seededRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function escalar(src) {
    const off = document.createElement('canvas');
    off.width = IMG_W; off.height = IMG_H;
    off.getContext('2d').drawImage(src, 0, 0, IMG_W, IMG_H);
    return off;
}

function cargarImagen(url, cb) {
    const esData = url.startsWith('data:');

    const intentar = (src, conProxy) => {
        const img = new Image();
        if (!esData) img.crossOrigin = 'anonymous';
        img.onload = () => {
            imagenCanvas = escalar(img);
            imgUrlActual  = url;
            actualizarMini();
            cb();
        };
        img.onerror = () => {
            if (conProxy || esData) {
                imagenCanvas = fallback();
                imgUrlActual  = url;
                actualizarMini();
                cb();
            } else {
                intentar(PROXY + encodeURIComponent(src), true);
            }
        };
        img.src = src;
    };

    intentar(url, false);
}

function fallback() {
    const off = document.createElement('canvas');
    off.width = IMG_W; off.height = IMG_H;
    const oc = off.getContext('2d');
    const g = oc.createLinearGradient(0, 0, IMG_W, IMG_H);
    g.addColorStop(0,   '#1a6b5a');
    g.addColorStop(0.5, '#64d8cb');
    g.addColorStop(1,   '#0a3d30');
    oc.fillStyle = g; oc.fillRect(0, 0, IMG_W, IMG_H);
    return off;
}

function actualizarMini() {
    if (!imagenCanvas) return;
    miniCv.width  = 160;
    miniCv.height = 99;
    miniCv.getContext('2d').drawImage(imagenCanvas, 0, 0, 160, 99);
}

function generarTabs(seed) {
    const rng = seededRng(seed);
    tabsH = Array.from({length: FILAS},   () => Array.from({length: COLS-1}, () => rng() > .5 ? 1 : -1));
    tabsV = Array.from({length: FILAS-1}, () => Array.from({length: COLS},   () => rng() > .5 ? 1 : -1));

    for (let f = 0; f < FILAS; f++) {
        for (let c = 0; c < COLS; c++) {
            const t = tabsDe(f, c);
            const vals = [t.top, t.right, t.bottom, t.left].filter(v => v !== 0);
            if (vals.length === 4 && Math.abs(vals.reduce((a, b) => a + b, 0)) === 4) {
                const ops = [];
                if (f > 0)       ops.push(() => { tabsV[f-1][c] *= -1; });
                if (c < COLS-1)  ops.push(() => { tabsH[f][c]   *= -1; });
                if (f < FILAS-1) ops.push(() => { tabsV[f][c]   *= -1; });
                if (c > 0)       ops.push(() => { tabsH[f][c-1] *= -1; });
                ops[Math.floor(rng() * ops.length)]();
            }
        }
    }
}

function tabsDe(f, c) {
    return {
        top:    f === 0       ? 0 : -tabsV[f-1][c],
        right:  c === COLS-1  ? 0 :  tabsH[f][c],
        bottom: f === FILAS-1 ? 0 :  tabsV[f][c],
        left:   c === 0       ? 0 : -tabsH[f][c-1],
    };
}

function generarOrden(seed) {
    const rng = seededRng(seed + 1);
    const lista = [];
    for (let f = 0; f < FILAS; f++)
        for (let c = 0; c < COLS; c++)
            lista.push({fila: f, col: c, id: `${f}-${c}`});
    for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
}

function calcularPosicionesIniciales(seed) {
    const rng = seededRng(seed + 2);
    const PW2 = PW + M * 2, PH2 = PH + M * 2, G = 10;
    const zonas = [
        {x1: 0,             y1: 0,              x2: AW,          y2: PAD - G},
        {x1: 0,             y1: PAD + IMG_H + G, x2: AW,          y2: AH},
        {x1: 0,             y1: 0,              x2: PAD - G,      y2: AH},
        {x1: PAD + IMG_W + G, y1: 0,            x2: AW,           y2: AH},
    ];
    const areas = zonas.map(z => Math.max(0, (z.x2 - z.x1) * (z.y2 - z.y1)));
    const total = areas.reduce((a, b) => a + b, 0);
    const MIN_D = Math.min(PW, PH) * 0.45;
    const colocadas2 = [];
    const pos = {};

    const zonaPond = () => {
        let rv = rng() * total;
        for (let i = 0; i < zonas.length; i++) { rv -= areas[i]; if (rv <= 0) return zonas[i]; }
        return zonas[zonas.length - 1];
    };

    const libre = (zona) => {
        const mx = zona.x2 - PW2, my = zona.y2 - PH2;
        if (mx < zona.x1 || my < zona.y1) return null;
        let best = null, bestD = -1;
        for (let i = 0; i < 40; i++) {
            const px = zona.x1 + rng() * (mx - zona.x1);
            const py = zona.y1 + rng() * (my - zona.y1);
            const cx = px + PW2/2, cy = py + PH2/2;
            const d  = colocadas2.reduce((m, p) => Math.min(m, Math.hypot(cx - p.cx, cy - p.cy)), Infinity);
            if (d >= MIN_D) return {px, py, cx, cy};
            if (d > bestD)  { bestD = d; best = {px, py, cx, cy}; }
        }
        return best;
    };

    orden.forEach(data => {
        const ordenZonas = [0, 1, 2, 3].sort(() => rng() - .5);
        let p = null;
        for (const zi of ordenZonas) { p = libre(zonas[zi]); if (p) break; }
        if (p) {
            pos[data.id] = {x: p.px, y: p.py};
            colocadas2.push({cx: p.cx, cy: p.cy});
        } else {
            const z = zonaPond();
            pos[data.id] = {
                x: z.x1 + rng() * Math.max(1, z.x2 - z.x1 - PW2),
                y: z.y1 + rng() * Math.max(1, z.y2 - z.y1 - PH2),
            };
        }
    });

    return pos;
}

function pathPieza(ctx, ox, oy, tabs) {
    const tw = PW * TAB, th = PH * TAB;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    if (!tabs.top)   { ctx.lineTo(ox + PW, oy); }
    else { const d = tabs.top;
        ctx.lineTo(ox+PW*.33, oy);
        ctx.bezierCurveTo(ox+PW*.33, oy-d*th, ox+PW*.67, oy-d*th, ox+PW*.67, oy);
        ctx.lineTo(ox+PW, oy); }
    if (!tabs.right) { ctx.lineTo(ox+PW, oy+PH); }
    else { const d = tabs.right;
        ctx.lineTo(ox+PW, oy+PH*.33);
        ctx.bezierCurveTo(ox+PW+d*tw, oy+PH*.33, ox+PW+d*tw, oy+PH*.67, ox+PW, oy+PH*.67);
        ctx.lineTo(ox+PW, oy+PH); }
    if (!tabs.bottom){ ctx.lineTo(ox, oy+PH); }
    else { const d = tabs.bottom;
        ctx.lineTo(ox+PW*.67, oy+PH);
        ctx.bezierCurveTo(ox+PW*.67, oy+PH+d*th, ox+PW*.33, oy+PH+d*th, ox+PW*.33, oy+PH);
        ctx.lineTo(ox, oy+PH); }
    if (!tabs.left)  { ctx.lineTo(ox, oy); }
    else { const d = tabs.left;
        ctx.lineTo(ox, oy+PH*.67);
        ctx.bezierCurveTo(ox-d*tw, oy+PH*.67, ox-d*tw, oy+PH*.33, ox, oy+PH*.33);
        ctx.lineTo(ox, oy); }
    ctx.closePath();
}

function crearCanvasPieza(f, c) {
    const tabs = tabsDe(f, c);
    const cv   = document.createElement('canvas');
    cv.width   = PW + M * 2;
    cv.height  = PH + M * 2;
    const ctx  = cv.getContext('2d');

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 8;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    pathPieza(ctx, M, M, tabs);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    pathPieza(ctx, M, M, tabs);
    ctx.clip();
    ctx.drawImage(imagenCanvas, -(c * PW) + M, -(f * PH) + M, IMG_W, IMG_H);
    ctx.restore();

    ctx.save();
    pathPieza(ctx, M, M, tabs);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    cv.dataset.id = `${f}-${c}`;
    return cv;
}

function construirTablero() {
    tableroEl.innerHTML = '';
    tableroEl.style.left = PAD + 'px';
    tableroEl.style.top  = PAD + 'px';
    areaJuego.style.width  = AW + 'px';
    areaJuego.style.height = AH + 'px';

    for (let f = 0; f < FILAS; f++) {
        for (let c = 0; c < COLS; c++) {
            const slot = document.createElement('div');
            slot.className        = 'slot';
            slot.dataset.targetId = `${f}-${c}`;
            tableroEl.appendChild(slot);
        }
    }
}

function renderizarPiezas() {
    areaJuego.querySelectorAll('canvas.pieza-suelta').forEach(el => el.remove());
    tableroEl.querySelectorAll('.slot').forEach(slot => {
        slot.innerHTML = '';
        slot.classList.remove('completado');
    });

    colocadas.forEach(id => {
        const [f, c] = id.split('-').map(Number);
        const slot = tableroEl.querySelector(`[data-target-id="${id}"]`);
        if (slot) {
            const cv = crearCanvasPieza(f, c);
            cv.style.left = `-${M}px`;
            cv.style.top  = `-${M}px`;
            cv.classList.add('pieza-canvas');
            slot.appendChild(cv);
            slot.classList.add('completado');
        }
    });

    orden.forEach(data => {
        if (colocadas.has(data.id)) return;
        const cv = crearCanvasPieza(data.fila, data.col);
        cv.classList.add('pieza-suelta');
        const p = posiciones[data.id] || {x: PAD, y: PAD};
        cv.style.left   = p.x + 'px';
        cv.style.top    = p.y + 'px';
        cv.style.zIndex = zCounter++;
        configurarArrastre(cv, data);
        areaJuego.appendChild(cv);
    });
}

function configurarArrastre(cv, data) {
    cv.addEventListener('mousedown',  e => { if (e.button) return; e.preventDefault(); iniciarArrastre(cv, data, e.clientX, e.clientY); });
    cv.addEventListener('touchstart', e => { e.preventDefault(); iniciarArrastre(cv, data, e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
}

function iniciarArrastre(cv, data, cx, cy) {
    const rect = cv.getBoundingClientRect();
    const offX = cx - rect.left;
    const offY = cy - rect.top;

    fantasma = cv.cloneNode(true);
    fantasma.className = 'pieza-fantasma';
    fantasma.style.cssText = `width:${cv.width}px;height:${cv.height}px;left:${cx - offX}px;top:${cy - offY}px`;
    document.body.appendChild(fantasma);

    cv.classList.add('arrastrando-origen');
    cv.style.zIndex = ++zCounter;

    arrastre = {data, origen: cv, offX, offY};
    update(r(`salas/${salaId}/arrastrando`), {[data.id]: uid});

    window.addEventListener('mousemove',  onMouse);
    window.addEventListener('mouseup',    onMouseUp);
    window.addEventListener('touchmove',  onTouch,   {passive: false});
    window.addEventListener('touchend',   onTouchUp, {passive: false});
}

const mover = (cx, cy) => {
    if (!fantasma || !arrastre) return;
    fantasma.style.left = (cx - arrastre.offX) + 'px';
    fantasma.style.top  = (cy - arrastre.offY) + 'px';

    const ar = areaJuego.getBoundingClientRect();
    const px = cx - ar.left - arrastre.offX;
    const py = cy - ar.top  - arrastre.offY;
    update(r(`salas/${salaId}/piezas/${arrastre.data.id}`), {x: px, y: py});

    tableroEl.querySelectorAll('.slot.over').forEach(s => s.classList.remove('over'));
    const bajo = document.elementFromPoint(cx, cy);
    const slot = bajo?.closest?.('.slot') ?? (bajo?.classList?.contains('slot') ? bajo : null);
    if (slot) slot.classList.add('over');
};

const onMouse   = e => mover(e.clientX, e.clientY);
const onTouch   = e => { e.preventDefault(); mover(e.touches[0].clientX, e.touches[0].clientY); };
const onMouseUp = e => soltar(e.clientX, e.clientY);
const onTouchUp = e => soltar(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

function soltar(cx, cy) {
    window.removeEventListener('mousemove',  onMouse);
    window.removeEventListener('mouseup',    onMouseUp);
    window.removeEventListener('touchmove',  onTouch);
    window.removeEventListener('touchend',   onTouchUp);

    tableroEl.querySelectorAll('.slot.over').forEach(s => s.classList.remove('over'));

    if (fantasma) { fantasma.remove(); fantasma = null; }
    if (!arrastre) return;

    const {data, origen} = arrastre;
    arrastre = null;

    origen.classList.remove('arrastrando-origen');
    remove(r(`salas/${salaId}/arrastrando/${data.id}`));

    const bajo = document.elementFromPoint(cx, cy);
    const slot = bajo?.closest?.('.slot') ?? (bajo?.classList?.contains('slot') ? bajo : null);

    if (slot) {
        soltarEnSlot(slot, data);
        return;
    }

    const ar    = areaJuego.getBoundingClientRect();
    const slotEl = tableroEl.querySelector(`[data-target-id="${data.id}"]`);
    if (slotEl && !slotEl.querySelector('canvas')) {
        const sr = slotEl.getBoundingClientRect();
        const sx = sr.left - ar.left;
        const sy = sr.top  - ar.top;
        if (Math.abs(cx - ar.left - (sx + PW/2)) < SNAP + PW/2 &&
            Math.abs(cy - ar.top  - (sy + PH/2)) < SNAP + PH/2) {
            soltarEnSlot(slotEl, data);
            return;
        }
    }

    const finalX = Math.max(0, Math.min(AW - PW, cx - ar.left - origen.width/2));
    const finalY = Math.max(0, Math.min(AH - PH, cy - ar.top  - origen.height/2));
    update(r(`salas/${salaId}/piezas/${data.id}`), {x: finalX, y: finalY});
}

function soltarEnSlot(slot, data) {
    if (slot.dataset.targetId !== data.id || slot.querySelector('canvas')) return;
    update(r(`salas/${salaId}/colocadas`), {[data.id]: true});
    remove(r(`salas/${salaId}/piezas/${data.id}`));
}

function publicarCursor(e) {
    const now = Date.now();
    if (now - cursorThrottle < 50) return;
    cursorThrottle = now;
    const t  = e.touches ? e.touches[0] : e;
    const ar = areaJuego.getBoundingClientRect();
    const x  = t.clientX - ar.left;
    const y  = t.clientY - ar.top;
    if (Math.abs(x - ultimoCursor.x) < 2 && Math.abs(y - ultimoCursor.y) < 2) return;
    ultimoCursor = {x, y};
    update(r(`salas/${salaId}/cursores/${uid}`), {x, y, color: miColor, ts: now});
}

function renderizarCursores(data) {
    cursoresEl.innerHTML = '';
    Object.entries(data || {}).forEach(([id, {x, y, color}]) => {
        if (id === uid) return;
        const el = document.createElement('div');
        el.className = 'cursor-remoto';
        el.style.cssText = `left:${x}px;top:${y}px`;
        el.innerHTML = `<svg width="16" height="20" viewBox="0 0 16 20">
            <path d="M0 0 L0 16 L4 12 L7 19 L9 18 L6 11 L11 11 Z"
                  fill="${color}" stroke="#000" stroke-width="0.8"/>
        </svg>`;
        cursoresEl.appendChild(el);
    });
}

function actualizarJugadores(data) {
    jugadores = data || {};
    const n = Object.keys(jugadores).length;
    document.getElementById('sala-jugadores').textContent =
        `👥 ${n} jugador${n === 1 ? '' : 'es'}`;
}

function aplicarEstadoCompleto(estado) {
    if (!estado) return;
    const {seed, imgUrl, piezas = {}, colocadas: col = {}} = estado;

    generarTabs(seed);
    orden = generarOrden(seed);

    const posBase = calcularPosicionesIniciales(seed);
    posiciones = {...posBase, ...piezas};

    colocadas = new Set(Object.keys(col).filter(k => col[k]));

    construirTablero();

    const urlFinal = imgUrl || DEF_URL;
    if (urlFinal === imgUrlActual && imagenCanvas) {
        renderizarPiezas();
        actualizarMini();
    } else {
        cargarImagen(urlFinal, () => {
            renderizarPiezas();
            actualizarMini();
        });
    }
}

function suscribir() {
    limpiarListeners();
    const unsubSeed = onValue(r(`salas/${salaId}/seed`), snap => {
        if (!snap.exists()) return;
        get(r(`salas/${salaId}`)).then(s => aplicarEstadoCompleto(s.val()));
    });

    const unsubImg = onValue(r(`salas/${salaId}/imgUrl`), snap => {
        const url = snap.val();
        if (!url || url === imgUrlActual) return;
        cargarImagen(url, () => { renderizarPiezas(); actualizarMini(); });
    });

    const unsubPiezas = onValue(r(`salas/${salaId}/piezas`), snap => {
        const data = snap.val() || {};
        Object.entries(data).forEach(([id, pos]) => {
            posiciones[id] = pos;
            if (arrastre && arrastre.data.id === id) return;
            const el = areaJuego.querySelector(`canvas.pieza-suelta[data-id="${id}"]`);
            if (el) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
        });
    });

    const unsubCol = onValue(r(`salas/${salaId}/colocadas`), snap => {
        const data  = snap.val() || {};
        Object.keys(data).filter(k => data[k] && !colocadas.has(k)).forEach(id => {
            colocadas.add(id);
            areaJuego.querySelector(`canvas.pieza-suelta[data-id="${id}"]`)?.remove();
            const [f, c] = id.split('-').map(Number);
            const slot   = tableroEl.querySelector(`[data-target-id="${id}"]`);
            if (slot && !slot.querySelector('canvas')) {
                const cv = crearCanvasPieza(f, c);
                cv.style.left = `-${M}px`;
                cv.style.top  = `-${M}px`;
                cv.classList.add('pieza-canvas');
                slot.appendChild(cv);
                slot.classList.add('completado');
            }
        });
    });

    const unsubCursores = onValue(r(`salas/${salaId}/cursores`), snap => renderizarCursores(snap.val()));
    const unsubJug      = onValue(r(`salas/${salaId}/jugadores`), snap => actualizarJugadores(snap.val()));

    areaJuego.addEventListener('mousemove', publicarCursor);
    areaJuego.addEventListener('touchmove', publicarCursor, {passive: true});

    onDisconnect(r(`salas/${salaId}/jugadores/${uid}`)).remove();
    onDisconnect(r(`salas/${salaId}/cursores/${uid}`)).remove();

    unsubs = [unsubSeed, unsubImg, unsubPiezas, unsubCol, unsubCursores, unsubJug];
}

function limpiarListeners() {
    unsubs.forEach(fn => typeof fn === 'function' && fn());
    unsubs = [];
}

async function salirDeSala() {
    if (!salaId) return;

    limpiarListeners();

    await remove(r(`salas/${salaId}/jugadores/${uid}`));
    await remove(r(`salas/${salaId}/cursores/${uid}`));

    const snap  = await get(r(`salas/${salaId}/jugadores`));
    const resto = snap.val() ? Object.keys(snap.val()).length : 0;

    if (resto === 0) {
        await remove(r(`salas/${salaId}`));
    }

    salaId = null;
    imgUrlActual = '';
    imagenCanvas = null;
    orden = []; posiciones = {}; colocadas = new Set();

    mainEl.style.display  = 'none';
    lobbyEl.style.display = 'flex';
    document.getElementById('sala-codigo-label').textContent = '';
    document.getElementById('sala-jugadores').textContent    = '';
}

function entrarASala(id, estadoInicial) {
    salaId  = id;
    miColor = COLORES[Math.floor(Math.random() * COLORES.length)];

    document.getElementById('sala-codigo-label').textContent = `Sala: ${salaId}`;
    lobbyEl.style.display = 'none';
    mainEl.style.display  = 'flex';

    update(r(`salas/${salaId}/jugadores/${uid}`), {color: miColor, ts: Date.now()});

    aplicarEstadoCompleto(estadoInicial);
    suscribir();
    ocultarLoading();
}

async function crearSala() {
    const id     = codigoAleatorio();
    const seed   = Math.floor(Math.random() * 1e9);
    const estado = {
        seed,
        imgUrl:      DEF_URL,
        piezas:      {},
        colocadas:   {},
        arrastrando: {},
        cursores:    {},
        jugadores:   {},
    };
    await set(r(`salas/${id}`), estado);
    entrarASala(id, estado);
}

async function unirseASala(id) {
    const snap = await get(r(`salas/${id}`));
    if (!snap.exists()) {
        document.getElementById('lobby-error').textContent = '⚠ Sala no encontrada.';
        ocultarLoading();
        return;
    }
    entrarASala(id, snap.val());
}

async function mezclar() {
    const seed    = Math.floor(Math.random() * 1e9);
    const imgSnap = await get(r(`salas/${salaId}/imgUrl`));
    const imgUrl  = imgSnap.val() || DEF_URL;

    await update(r(`salas/${salaId}`), {
        seed,
        imgUrl,
        piezas:      {},
        colocadas:   {},
        arrastrando: {},
    });

}

function cambiarImagen(src) {
    if (src.startsWith('data:')) {
        cargarImagen(src, () => { renderizarPiezas(); actualizarMini(); });
        toast('Imagen local — solo visible para ti');
        return;
    }
    update(r(`salas/${salaId}`), {imgUrl: src});

}

uid = 'u_' + Math.random().toString(36).slice(2, 10);

document.getElementById('btn-crear').addEventListener('click', crearSala);

document.getElementById('btn-unirse').addEventListener('click', () => {
    const codigo = document.getElementById('input-codigo').value.trim().toUpperCase();
    if (codigo.length < 4) {
        document.getElementById('lobby-error').textContent = 'código invalido.';
        return;
    }
    document.getElementById('lobby-error').textContent = '';
    unirseASala(codigo);
});

document.getElementById('input-codigo').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-unirse').click();
});

document.getElementById('btn-copiar').addEventListener('click', () => {
    navigator.clipboard.writeText(salaId).then(() => toast('¡Código copiado!'));
});

document.getElementById('btn-salir').addEventListener('click', async () => {
    await salirDeSala();
});

document.getElementById('btn-mezclar').addEventListener('click', mezclar);

document.getElementById('btn-url').addEventListener('click', () => {
    const url = document.getElementById('img-url').value.trim();
    if (url) cambiarImagen(url);
});

document.getElementById('img-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-url').click();
});

document.getElementById('img-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => cambiarImagen(ev.target.result);
    reader.readAsDataURL(file);
});

window.addEventListener('beforeunload', () => {
    if (!salaId) return;
    remove(r(`salas/${salaId}/jugadores/${uid}`));
    remove(r(`salas/${salaId}/cursores/${uid}`));
});