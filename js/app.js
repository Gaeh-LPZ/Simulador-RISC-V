import konva from "konva";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, keymap, Decoration } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { CPU } from './cpu.js';
import { MemoriaDePrograma } from './memoriaDePrograma.js';
import { MemoriaDeDatos } from './memoriaDeDatos.js';
import { Assembler } from './assembler.js';

// --- CONFIGURACIÓN DE RESALTADO CODEMIRROR ---
const setActiveLine = StateEffect.define();
const activeLineField = StateField.define({
    create() { return Decoration.none; },
    update(lines, tr) {
        lines = lines.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setActiveLine)) {
                lines = e.value === null ? Decoration.none : Decoration.set([
                    Decoration.line({ class: "active-instruction" }).range(e.value)
                ]);
            }
        }
        return lines;
    },
    provide: f => EditorView.decorations.from(f)
});

// -------------------------
// Editor CodeMirror (editable)
// -------------------------
const INITIAL_DOC = `addi x1, x0, 10
addi x2, x0, 5
add x3, x1, x2
sw x3, 0(x0)`;

let startState = EditorState.create({
    doc: INITIAL_DOC,
    extensions: [
        keymap.of(defaultKeymap),
        activeLineField,
        EditorView.editable.of(true)
    ]
});

let view = new EditorView({
    state: startState,
    parent: document.getElementById('editor')
});

function getEditorCode() {
    return view.state.doc.toString();
}

function setEditorCode(code) {
    const tr = view.state.update({
        changes: { from: 0, to: view.state.doc.length, insert: code }
    });
    view.dispatch(tr);
    view.focus();
}

// --- SISTEMA ---
const memProg = new MemoriaDePrograma(1024);
const memDatos = new MemoriaDeDatos(1024);
const cpu = new CPU({ memoriaPrograma: memProg, memoriaDatos: memDatos });
const assembler = new Assembler();

// ==========================================
// --- VISUALIZACIÓN (KONVA) ---
// ==========================================
const SCENE_WIDTH = 1250;
const SCENE_HEIGHT = 700;

let visualModules = {};
let visualLayer = null;
let visualStage = null;
let visualWires = []; // array de { line, from, to }
let lastDebug = null; // debug info devuelta por cpu.step()

// Helper: buscar la clave real de un módulo entre varias aliases
function findModuleKey(candidates) {
    if (!visualModules) return null;
    for (let cand of candidates) {
        if (!cand) continue;
        if (visualModules[cand]) return cand;

        const norm = String(cand).toUpperCase().replace(/\s+/g, '_');
        if (visualModules[norm]) return norm;

        const plain = String(cand).toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (visualModules[plain]) return plain;
    }
    return null;
}

// 1. Inicializar el diagrama visual
function initVisualDatapath() {
    const container = document.getElementById('datapath-container');
    if (!container) return;

    visualStage = new Konva.Stage({
        container: 'datapath-container',
        width: container.clientWidth,
        height: container.clientHeight,
    });

    visualLayer = new Konva.Layer();
    visualStage.add(visualLayer);

    // Crear contenido usando TopDatapath
    if (window.TopDatapath) {
        const top = window.TopDatapath.create({ layer: visualLayer });

        visualModules = top.modules || {};
        visualWires = top.wireMap || [];
        visualLayer.mainGroup = top.group;

        // Inicial: dejar módulos opacos y wires en color neutro
        Object.keys(visualModules).forEach((k) => {
            const m = visualModules[k];
            if (m && m.group) {
                m.group.opacity(0.25);
            }
        });
        visualWires.forEach((w) => {
            if (w && w.line) {
                w.line.stroke('#4a4a4a');
                w.line.strokeWidth(2);
            }
        });
    }

    // Fit to screen
    const fitStageIntoParentContainer = () => {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const scaleX = containerWidth / SCENE_WIDTH;
        const scaleY = containerHeight / SCENE_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        visualStage.width(containerWidth);
        visualStage.height(containerHeight);

        if (visualLayer.mainGroup) {
            visualLayer.mainGroup.scale({ x: scale, y: scale });

            const currentHeight = SCENE_HEIGHT * scale;
            const yOffset = (containerHeight - currentHeight) / 2;
            const currentWidth = SCENE_WIDTH * scale;
            const xOffset = (containerWidth - currentWidth) / 2;

            visualLayer.mainGroup.position({
                x: xOffset > 0 ? xOffset : 0,
                y: yOffset > 0 ? yOffset : 0
            });
        }
        visualLayer.batchDraw();
    };

    const resizeObserver = new ResizeObserver(() => fitStageIntoParentContainer());
    resizeObserver.observe(container);
    fitStageIntoParentContainer();
}

// Helper para escribir valor central del módulo (usa wrapper si existe)
function setModuleValue(name, lines) {
    const mod = visualModules[name];
    if (!mod) return;

    const BASE_FONT_SIZE = 16;
    const LINE_HEIGHT = 1.2;
    const DEFAULT_WIDTH = 140;

    if (typeof mod.setValueLabel === 'function') {
        mod.setValueLabel(lines);
        const lbl = mod.group && mod.group._valueLabel ? mod.group._valueLabel : null;
        if (lbl) {
            lbl.fontSize(BASE_FONT_SIZE);
            lbl.lineHeight(LINE_HEIGHT);
            lbl.fontStyle('bold');
            lbl.width(DEFAULT_WIDTH);
            if (mod.group.getLayer) mod.group.getLayer().batchDraw();
        }
        return;
    }

    if (!mod.group._valueLabel) {
        const label = new Konva.Text({
            x: 10,
            y: 30,
            fontSize: BASE_FONT_SIZE,
            fontFamily: 'Ubuntu Mono, monospace',
            fontStyle: 'bold',
            fill: '#3b2c12',
            listening: false,
            width: DEFAULT_WIDTH,
            align: 'left',
            lineHeight: LINE_HEIGHT
        });
        mod.group.add(label);
        mod.group._valueLabel = label;
    } else {
        const lbl = mod.group._valueLabel;
        lbl.fontSize(BASE_FONT_SIZE);
        lbl.lineHeight(LINE_HEIGHT);
        lbl.fontStyle('bold');
        lbl.width(DEFAULT_WIDTH);
    }

    mod.group._valueLabel.text((lines || []).join('\n'));
    if (mod.group.getLayer) mod.group.getLayer().batchDraw();
}

// Helper: activar/desactivar módulo (cambia opacidad)
function setModuleActive(name, on) {
    const mod = visualModules[name];
    if (!mod) return;
    if (typeof mod.setActive === 'function') mod.setActive(on);
    else if (mod.group) {
        mod.group.opacity(on ? 1 : 0.25);
        if (mod.group.getLayer()) mod.group.getLayer().batchDraw();
    }
}

// Helper: iluminar wire meta
function setWireActive(meta, on) {
    if (!meta || !meta.line) return;
    if (on) {
        meta.line.to({
            stroke: '#60a5fa',
            strokeWidth: 4,
            duration: 0.08
        });
    } else {
        meta.line.to({
            stroke: '#4a4a4a',
            strokeWidth: 2,
            duration: 0.08
        });
    }
}

// Helper para encontrar wires conectadas a un módulo (por nombre)
function wiresForModule(name) {
    if (!visualWires) return [];
    return visualWires.filter(w => (w.from && w.from.name === name) || (w.to && w.to.name === name));
}

// 3. Función principal que lee la CPU y actualiza Konva
function updateVisualsFromCPU() {
    if (!visualLayer) return;

    // Resolver claves reales de módulos (según nombres de la vista)
    const KEY_PC        = findModuleKey(['PC', 'ProgramCounter', 'PROGRAMCOUNTER']);
    const KEY_MEMPROG   = findModuleKey(['MEM_PROG', 'MemoriaDePrograma', 'MEMORIADEPROGRAMA']);
    const KEY_UCTRL     = findModuleKey(['UCTRL', 'UnidadDeControl', 'UNIDADDECONTROL']);
    const KEY_REGFILE   = findModuleKey(['REGFILE', 'BancoDeRegistros', 'BANCODEREGISTROS']);
    const KEY_ALU       = findModuleKey(['ALU']);
    const KEY_MEMDATA   = findModuleKey(['MEM_DATA', 'MemoriaDeDatos', 'MEMORIADATOS']);
    const KEY_MUX_ALUSRC= findModuleKey(['MuxALUSrc', 'MUX_ALUSRC', 'MuxALUSrcModule']);
    const KEY_MUX_ALU2REG = findModuleKey(['MUX_ALU2REG', 'MuxALU2REG', 'MuxALU2REGModule']);
    const KEY_GEN_IMM   = findModuleKey(['GeneradorInmediatos', 'GEN_IMM']);
    const KEY_PC_INC    = findModuleKey(['PC Increment/Branch', 'PCIncrementBranch', 'PC_INC']);
    const KEY_BRANCH    = findModuleKey(['BranchLogic', 'BRANCHLOGIC', 'BRANCH']);

    // Estado básico: PC y MemProg
    if (KEY_PC) {
        const currentPC = cpu.pc.valor;
        setModuleValue(KEY_PC, [`PC: 0x${currentPC.toString(16).toUpperCase().padStart(4,'0')}`]);
    }

    if (KEY_MEMPROG) {
        let rawInst = 0;
        try { rawInst = cpu.memoriaPrograma.leer(cpu.pc.valor); } catch(e){}
        setModuleValue(KEY_MEMPROG, [`Inst: 0x${(rawInst >>> 0).toString(16).toUpperCase().padStart(8,'0')}`]);
    }

    const dbg = lastDebug;

    // Default: opacar todos
    Object.keys(visualModules).forEach(k => setModuleActive(k, false));
    if (KEY_PC) setModuleActive(KEY_PC, true);
    if (KEY_MEMPROG) setModuleActive(KEY_MEMPROG, true);

    // Reset wires
    visualWires.forEach(w => setWireActive(w, false));

    if (dbg) {
        // Para ser robustos con el nombre del campo: immediato vs inmediato
        const immVal = (dbg.inmediato !== undefined ? dbg.inmediato : dbg.immediato);

        // Unidad de control
        try {
            if (dbg.control && KEY_UCTRL) {
                const opcode = dbg.control.opcode || (dbg.instruccion & 0x7F);
                let typeStr = '---';
                if (opcode === 0x33) typeStr = "R-Type";
                else if (opcode === 0x13) typeStr = "I-Type (ALU)";
                else if (opcode === 0x03) typeStr = "I-Type (Load)";
                else if (opcode === 0x23) typeStr = "S-Type";
                else if (opcode === 0x63) typeStr = "B-Type";

                setModuleValue(KEY_UCTRL, [
                    `Opcode: 0x${(opcode).toString(16)}`,
                    `Type: ${typeStr}`,
                    `rd: ${dbg.control.rd}`,
                    `rs1: ${dbg.control.rs1}`,
                    `rs2: ${dbg.control.rs2}`
                ]);
                setModuleActive(KEY_UCTRL, true);

                if (KEY_MEMPROG) wiresForModule(KEY_MEMPROG).forEach(w => {
                    if (w.to && (w.to.name === 'UnidadDeControl' || w.to.name === KEY_UCTRL)) setWireActive(w, true);
                });
            }
        } catch (e) {}

        // Registros
        try {
            if (KEY_REGFILE && (typeof dbg.valorRs1 !== 'undefined' || typeof dbg.valorRs2 !== 'undefined')) {
                const rs1 = typeof dbg.valorRs1 !== 'undefined'
                    ? dbg.valorRs1
                    : cpu.bancoRegistros.leerRegistro(dbg.control ? dbg.control.rs1 : 0);
                const rs2 = typeof dbg.valorRs2 !== 'undefined'
                    ? dbg.valorRs2
                    : cpu.bancoRegistros.leerRegistro(dbg.control ? dbg.control.rs2 : 0);
                const rdName = dbg.control && typeof dbg.control.rd !== 'undefined' ? `rd:${dbg.control.rd}` : '';
                const rdVal = (dbg.control && typeof dbg.control.rd !== 'undefined')
                    ? cpu.bancoRegistros.leerRegistro(dbg.control.rd)
                    : 0;

                setModuleValue(KEY_REGFILE, [
                    `rd1: 0x${(rs1 >>> 0).toString(16).padStart(8,'0')}`,
                    `rd2: 0x${(rs2 >>> 0).toString(16).padStart(8,'0')}`,
                    `${rdName}: 0x${(rdVal>>>0).toString(16).padStart(8,'0')}`
                ]);
                setModuleActive(KEY_REGFILE, true);

                wiresForModule(KEY_REGFILE).forEach(w => {
                    if (w.to && (w.to.name === 'ALU' || w.to.name === KEY_MUX_ALUSRC || w.to.name === 'MuxALUSrc')) {
                        setWireActive(w, true);
                    }
                });
            }
        } catch (e) {}

        // ALU
        try {
            if (KEY_ALU && (typeof dbg.operandoA !== 'undefined' || typeof dbg.operandoB !== 'undefined' || typeof dbg.resultadoALU !== 'undefined')) {
                const opA = dbg.operandoA;
                const opB = dbg.operandoB;
                const res = dbg.resultadoALU;
                setModuleValue(KEY_ALU, [
                    `opA: 0x${(opA>>>0).toString(16).padStart(8,'0')}`,
                    `opB: 0x${(opB>>>0).toString(16).padStart(8,'0')}`,
                    `res: 0x${(res>>>0).toString(16).padStart(8,'0')}`
                ]);
                setModuleActive(KEY_ALU, true);
                visualWires.forEach(w => {
                    if (w.to && w.to.name === 'ALU') setWireActive(w, true);
                    if (w.from && w.from.name === 'ALU') setWireActive(w, true);
                });
            }
        } catch (e) {}

        // Mux ALUSrc
        try {
            if (KEY_MUX_ALUSRC && (immVal !== undefined || (dbg.control && dbg.control.aluSrcInm))) {
                setModuleValue(KEY_MUX_ALUSRC, [
                    `rd2: ${dbg.valorRs2 !== undefined ? dbg.valorRs2 : ''}`,
                    `imm: ${immVal !== undefined ? immVal : ''}`,
                    `sel: ${dbg.control && dbg.control.aluSrcInm ? dbg.control.aluSrcInm : ''}`
                ]);
                setModuleActive(KEY_MUX_ALUSRC, true);
            }
        } catch (e) {}

        // Generador de Inmediatos
        try {
            if (KEY_GEN_IMM && immVal !== undefined) {
                setModuleValue(KEY_GEN_IMM, [`imm: ${immVal}`]);
                setModuleActive(KEY_GEN_IMM, true);
                visualWires.forEach(w => {
                    if (w.from && (w.from.name === 'GeneradorInmediatos' || w.from.name === KEY_GEN_IMM)) {
                        setWireActive(w, true);
                    }
                });
            }
        } catch (e) {}

        // Memoria de datos
        try {
            if (KEY_MEMDATA && (dbg.direccionMem !== undefined || dbg.datoMemoria !== undefined || (dbg.control && (dbg.control.memRead || dbg.control.memWrite)))) {
                setModuleValue(KEY_MEMDATA, [
                    `addr: 0x${((dbg.direccionMem||0)>>>0).toString(16).padStart(8,'0')}`,
                    `wdata: ${dbg.valorRs2!==undefined ? dbg.valorRs2 : ''}`,
                    `rdata: ${dbg.datoMemoria!==undefined ? dbg.datoMemoria : ''}`,
                    `we: ${dbg.control ? !!dbg.control.memWrite : false}`
                ]);
                setModuleActive(KEY_MEMDATA, true);
            }
        } catch (e) {}

        // Mux ALU2REG / writeback
        try {
            if (KEY_MUX_ALU2REG && typeof dbg.resultadoALU !== 'undefined') {
                const memRead = dbg.datoMemoria !== undefined ? dbg.datoMemoria : 0;
                const aluRes = dbg.resultadoALU;
                setModuleValue(KEY_MUX_ALU2REG, [
                    `alu_res: 0x${(aluRes>>>0).toString(16).padStart(8,'0')}`,
                    `mem_rd: ${memRead}`,
                    `sel: ${(dbg.control && typeof dbg.control.memToReg !== 'undefined') ? dbg.control.memToReg : ''}`
                ]);
                setModuleActive(KEY_MUX_ALU2REG, true);
            }
        } catch (e) {}

        // PC Increment / Branch + BranchLogic
        try {
            if (typeof dbg.tomarBranch !== 'undefined') {
                if (KEY_PC_INC) {
                    setModuleValue(KEY_PC_INC, [
                        `next: 0x${(dbg.pcSiguiente>>>0).toString(16).padStart(8,'0')}`,
                        `branch: ${dbg.tomarBranch}`
                    ]);
                    setModuleActive(KEY_PC_INC, true);
                }
                if (KEY_BRANCH) {
                    setModuleActive(KEY_BRANCH, !!dbg.tomarBranch);
                }
            }
        } catch (e) {}
    } else {
        // Fallback cuando no hay debug
        if (KEY_REGFILE) setModuleValue(KEY_REGFILE, ['Reg File', 'Active']);
        if (KEY_MEMDATA) setModuleValue(KEY_MEMDATA, ['Data Mem', 'Ready']);
    }

    visualLayer.batchDraw();
}

// Inicializar visuales al cargar la página
window.addEventListener('load', initVisualDatapath);

// ==========================================
// --- LÓGICA DE CONTROL / BOTONES ---
// ==========================================

// ESTADO GLOBAL
let currentLineMap = [];
let cpuHistory = [];
let isProgramLoaded = false;
let playInterval = null;
let currentMachineCode = [];

// DOM
const btnRun = document.getElementById('btn-run');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnPlay = document.getElementById('btn-play');
const btnReset = document.getElementById('btn-reset');
const consoleOut = document.getElementById('console-output');
const regContainer = document.getElementById('registers-container');
const memContainer = document.getElementById('memory-container');

// HELPERS
function logConsole(msg, type = 'info') {
    const color = type === 'error' ? 'text-red-500' : 'text-green-400';
    consoleOut.innerHTML += `<div class="${color}">> ${msg}</div>`;
    consoleOut.scrollTop = consoleOut.scrollHeight;
}

function updateUI() {
    // 1. DOM: Registros
    if (regContainer) {
        regContainer.innerHTML = '';
        const regs = cpu.bancoRegistros.registros;
        const abiNames = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5'];
        for (let i = 0; i < 32; i++) {
            const val = regs[i];
            const hex = '0x' + (val >>> 0).toString(16).padStart(8, '0');
            const name = i < abiNames.length ? abiNames[i] : `x${i}`;
            const div = document.createElement('div');
            div.className = val !== 0 ? 'text-yellow-400' : 'text-gray-400';
            div.textContent = `${name.padEnd(4)} : ${hex} (${val})`;
            regContainer.appendChild(div);
        }
    }

    // 2. DOM: Memoria de datos
    if (memContainer) {
        memContainer.innerHTML = '';
        const rawMem = cpu.memoriaDatos.memoria;
        let hasData = false;
        for (let i = 0; i < rawMem.length; i++) {
            if (rawMem[i] !== 0) {
                hasData = true;
                const addr = i * 4;
                const hexAddr = '0x' + addr.toString(16).padStart(4, '0');
                const valHex = '0x' + (rawMem[i] >>> 0).toString(16).padStart(8, '0');
                const div = document.createElement('div');
                div.textContent = `[${hexAddr}] : ${valHex} (${rawMem[i]})`;
                memContainer.appendChild(div);
            }
        }
        if (!hasData) {
            memContainer.innerHTML = '<div class="text-gray-500">Memoria vacía</div>';
        }
    }

    // 3. Editor: resaltar la línea correspondiente al PC actual
    if (view && currentLineMap.length > 0) {
        const instructionIndex = cpu.pc.valor / 4;
        if (instructionIndex < currentLineMap.length) {
            const lineNumber = currentLineMap[instructionIndex];
            if (lineNumber <= view.state.doc.lines) {
                const lineInfo = view.state.doc.line(lineNumber);
                view.dispatch({ effects: setActiveLine.of(lineInfo.from) });
            }
        } else {
            view.dispatch({ effects: setActiveLine.of(null) });
        }
    }

    // 4. VISUAL
    updateVisualsFromCPU();
}

function stopAutoPlay() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
}

function softReset() {
    stopAutoPlay();
    cpu.pc.reset();
    cpu.bancoRegistros.reset();
    cpu.memoriaDatos.reset();
    cpu.ciclos = 0;
    cpuHistory = [];
    lastDebug = null;

    if (currentMachineCode.length > 0) {
        cpu.memoriaPrograma.memoria.fill(0);
        cpu.memoriaPrograma.cargarProgramaSecuencial(currentMachineCode);
    }
    updateUI();
}

// BOTONES

// RUN
btnRun.addEventListener('click', () => {
    stopAutoPlay();
    consoleOut.innerHTML = '';

    try {
        const codeText = getEditorCode();
        const result = assembler.assemble(codeText);

        currentLineMap = result.lineMap;
        currentMachineCode = result.machineCode;

        isProgramLoaded = true;
        softReset();
        logConsole("Código ensamblado y cargado.");
    } catch (error) {
        isProgramLoaded = false;
        logConsole(error.message, 'error');
    }
});

// RESET
btnReset.addEventListener('click', () => {
    if (!isProgramLoaded) {
        logConsole("No hay programa cargado para reiniciar.", "error");
        return;
    }
    softReset();
    logConsole("Simulación reiniciada.");
});

// PLAY
btnPlay.addEventListener('click', () => {
    if (!isProgramLoaded) return;

    if (playInterval) {
        stopAutoPlay();
        logConsole("Pausado.");
        return;
    }

    logConsole("Ejecución continua iniciada...");

    playInterval = setInterval(() => {
        const instructionIndex = cpu.pc.valor / 4;

        if (instructionIndex >= currentLineMap.length) {
            stopAutoPlay();
            logConsole("Fin del programa alcanzado.");
            return;
        }

        cpuHistory.push({
            pc: cpu.pc.valor,
            ciclos: cpu.ciclos,
            regs: cpu.bancoRegistros.exportarEstado(),
            mem: cpu.memoriaDatos.exportarEstado()
        });

        try {
            const dbg = cpu.step();
            lastDebug = dbg;
            updateUI();
        } catch (e) {
            stopAutoPlay();
            logConsole(`Error: ${e.message}`, 'error');
        }

    }, 500);
});

// NEXT
btnNext.addEventListener('click', () => {
    if (!isProgramLoaded) return;
    stopAutoPlay();

    const instructionIndex = cpu.pc.valor / 4;
    if (instructionIndex >= currentLineMap.length) return;

    cpuHistory.push({
        pc: cpu.pc.valor,
        ciclos: cpu.ciclos,
        regs: cpu.bancoRegistros.exportarEstado(),
        mem: cpu.memoriaDatos.exportarEstado()
    });

    try {
        const dbg = cpu.step();
        lastDebug = dbg;
        updateUI();
    } catch (e) {
        logConsole(e.message, 'error');
    }
});

// PREV
btnPrev.addEventListener('click', () => {
    if (!isProgramLoaded || cpuHistory.length === 0) return;
    stopAutoPlay();

    const state = cpuHistory.pop();
    cpu.pc.set(state.pc);
    cpu.ciclos = state.ciclos;
    cpu.bancoRegistros.importarEstado(state.regs);
    cpu.memoriaDatos.importarEstado(state.mem);

    lastDebug = null;
    updateUI();
    logConsole("Retroceso.");
});
