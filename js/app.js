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

let startState = EditorState.create({
    doc: "addi x1, x0, 10\naddi x2, x0, 5\nadd x3, x1, x2\nsw x3, 0(x0)",
    extensions: [keymap.of(defaultKeymap), activeLineField]
});

let view = new EditorView({
    state: startState,
    parent: document.getElementById('editor')
});

// --- SISTEMA ---
const memProg = new MemoriaDePrograma(1024);
const memDatos = new MemoriaDeDatos(1024);
const cpu = new CPU({ memoriaPrograma: memProg, memoriaDatos: memDatos });
const assembler = new Assembler();

// ==========================================
// --- VISUALIZACIÓN (KONVA) - ENHANCED CÓDIGO ---
// ==========================================
const SCENE_WIDTH = 1250; 
const SCENE_HEIGHT = 700;

let visualModules = {}; 
let visualLayer = null;
let visualStage = null;
let visualWires = []; // array de { line, from, to }
let lastDebug = null;  // debug info devuelta por cpu.step()

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

        // top.modules debería contener wrappers (TopDatapath.fix.js lo prepara)
        visualModules = top.modules || {};

        // top.wireMap es la lista de wires con from/to
        visualWires = top.wireMap || [];

        // Guardamos el grupo principal para escalarlo
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
                // estilo base
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
        let scale = Math.min(scaleX, scaleY); // Escala proporcional

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
    if (typeof mod.setValueLabel === 'function') {
        mod.setValueLabel(lines);
    } else {
        // fallback: crear un texto dentro del group
        if (!mod.group._valueLabel) {
            const label = new Konva.Text({
                x: 10, y: 35, fontSize: 11,
                fontFamily: 'Ubuntu Mono, monospace', fill: '#3b2c12',
                listening: false,
            });
            mod.group.add(label);
            mod.group._valueLabel = label;
        }
        mod.group._valueLabel.text((lines || []).join('\n'));
        if (mod.group.getLayer()) mod.group.getLayer().batchDraw();
    }
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

    // Estado basico: PC y MemProg
    const currentPC = cpu.pc.valor;
    setModuleValue('PC', [`PC: 0x${currentPC.toString(16).toUpperCase().padStart(4,'0')}`]);

    let rawInst = 0;
    try { rawInst = cpu.memoriaPrograma.leer(currentPC); } catch(e){}
    setModuleValue('MEM_PROG', [`Inst: 0x${(rawInst >>> 0).toString(16).toUpperCase().padStart(8,'0')}`]);

    // Si tenemos debug de la última instrucción, lo usamos para rellenar módulos
    const dbg = lastDebug;

    // Default: opacar todos menos PC/MEM_PROG
    Object.keys(visualModules).forEach(k => setModuleActive(k, false));
    setModuleActive('PC', true);
    setModuleActive('MEM_PROG', true);

    // Reset wires a estado inactivo
    visualWires.forEach(w => setWireActive(w, false));

    if (dbg) {
        // Unidad de control
        try {
            if (dbg.control) {
                const opcode = dbg.control.opcode || (dbg.instruccion & 0x7F);
                let typeStr = '---';
                if (opcode === 0x33) typeStr = "R-Type";
                else if (opcode === 0x13) typeStr = "I-Type (ALU)";
                else if (opcode === 0x03) typeStr = "I-Type (Load)";
                else if (opcode === 0x23) typeStr = "S-Type";
                else if (opcode === 0x63) typeStr = "B-Type";

                setModuleValue('UCTRL', [
                    `Opcode: 0x${(opcode).toString(16)}`,
                    `Type: ${typeStr}`,
                    `rd: ${dbg.control.rd}`,
                    `rs1: ${dbg.control.rs1}`,
                    `rs2: ${dbg.control.rs2}`
                ]);
                setModuleActive('UCTRL', true);
                // iluminar wires desde MEM_PROG -> UCTRL
                wiresForModule('MEM_PROG').forEach(w => {
                    if (w.to && (w.to.name === 'UCTRL' || w.to.name === 'UnidadDeControl')) setWireActive(w, true);
                });
            }
        } catch (e){}

        // Registros
        try {
            // mostrar valores de rs1/rs2
            if (typeof dbg.valorRs1 !== 'undefined' || typeof dbg.valorRs2 !== 'undefined') {
                const rs1 = typeof dbg.valorRs1 !== 'undefined' ? dbg.valorRs1 : cpu.bancoRegistros.leerRegistro(dbg.control ? dbg.control.rs1 : 0);
                const rs2 = typeof dbg.valorRs2 !== 'undefined' ? dbg.valorRs2 : cpu.bancoRegistros.leerRegistro(dbg.control ? dbg.control.rs2 : 0);
                const rdName = dbg.control && typeof dbg.control.rd !== 'undefined' ? `rd:${dbg.control.rd}` : '';
                const rdVal = (dbg.control && typeof dbg.control.rd !== 'undefined') ? cpu.bancoRegistros.leerRegistro(dbg.control.rd) : 0;
                setModuleValue('REGFILE', [
                    `rd1: 0x${(rs1 >>> 0).toString(16).padStart(8,'0')}`,
                    `rd2: 0x${(rs2 >>> 0).toString(16).padStart(8,'0')}`,
                    `${rdName}: 0x${(rdVal>>>0).toString(16).padStart(8,'0')}`
                ]);
                setModuleActive('REGFILE', true);
                // iluminar wires desde Banco -> ALU / MuxALUSrc
                wiresForModule('REGFILE').forEach(w => {
                    if (w.to && (w.to.name === 'ALU' || w.to.name === 'MUX_ALUSRC')) setWireActive(w, true);
                });
            }
        } catch (e) {}

        // ALU
        try {
            if (typeof dbg.operandoA !== 'undefined' || typeof dbg.operandoB !== 'undefined' || typeof dbg.resultadoALU !== 'undefined') {
                const opA = dbg.operandoA;
                const opB = dbg.operandoB;
                const res = dbg.resultadoALU;
                setModuleValue('ALU', [
                    `opA: 0x${(opA>>>0).toString(16).padStart(8,'0')}`,
                    `opB: 0x${(opB>>>0).toString(16).padStart(8,'0')}`,
                    `res: 0x${(res>>>0).toString(16).padStart(8,'0')}`
                ]);
                setModuleActive('ALU', true);
                // iluminar entradas y salidas relacionadas
                visualWires.forEach(w => {
                    if (w.to && w.to.name === 'ALU') setWireActive(w, true);
                    if (w.from && w.from.name === 'ALU') setWireActive(w, true);
                });
            }
        } catch (e) {}

        // Mux ALUSrc
        try {
            // mostrar imm/rd2 y seleccion
            if (dbg && dbg.immediato !== undefined) {
                setModuleValue('MUX_ALUSRC', [
                    `rd2: ${dbg.valorRs2 !== undefined ? dbg.valorRs2 : ''}`,
                    `imm: ${dbg.immediato}`,
                    `sel: ${dbg.control && dbg.control.aluSrcInm ? dbg.control.aluSrcInm : ''}`
                ]);
                setModuleActive('MUX_ALUSRC', true);
            }
        } catch (e) {}

        // Memoria de datos
        try {
            if (dbg && (dbg.direccionMem !== undefined || dbg.datoMemoria !== undefined || dbg.control && (dbg.control.memRead || dbg.control.memWrite))) {
                setModuleValue('MEM_DATA', [
                    `addr: 0x${((dbg.direccionMem||0)>>>0).toString(16).padStart(8,'0')}`,
                    `wdata: ${dbg.valorRs2!==undefined ? dbg.valorRs2 : ''}`,
                    `rdata: ${dbg.datoMemoria!==undefined ? dbg.datoMemoria : ''}`,
                    `we: ${dbg.control ? !!dbg.control.memWrite : false}`
                ]);
                setModuleActive('MEM_DATA', true);
                // iluminar wires ALU->MemDatos y MemDatos->MuxALU2REG
                visualWires.forEach(w => {
                    if ( (w.from && w.from.name === 'ALU' && w.to && w.to.name === 'MEM_DATA') ||
                         (w.from && w.from.name === 'MEM_DATA' && w.to && w.to.name === 'MUX_ALU2REG') ) {
                        setWireActive(w, true);
                    }
                });
            }
        } catch (e) {}

        // MuxALU2REG / writeback
        try {
            if (dbg && typeof dbg.resultadoALU !== 'undefined') {
                const memRead = dbg.datoMemoria !== undefined ? dbg.datoMemoria : 0;
                const aluRes = dbg.resultadoALU;
                setModuleValue('MUX_ALU2REG', [
                    `alu_res: 0x${(aluRes>>>0).toString(16).padStart(8,'0')}`,
                    `mem_rd: ${memRead}`,
                    `sel: ${(dbg.control && typeof dbg.control.memToReg !== 'undefined') ? dbg.control.memToReg : ''}`
                ]);
                setModuleActive('MUX_ALU2REG', true);
                // iluminar wires mux->Banco
                visualWires.forEach(w => {
                    if ( (w.from && w.from.name === 'MUX_ALU2REG' && w.to && w.to.name === 'REGFILE') ||
                         (w.from && w.from.name === 'MUX_ALU2REG' && (w.to && w.to.name === 'BancoDeRegistros')) ) {
                        setWireActive(w, true);
                    }
                });
            }
        } catch (e) {}

        // GenImm
        try {
            if (dbg && typeof dbg.immediato !== 'undefined') {
                setModuleValue('GEN_IMM', [`imm: ${dbg.immediato}`]);
                setModuleActive('GEN_IMM', true);
                // iluminar wires genImm->mux/pcInc
                visualWires.forEach(w => {
                    if (w.from && w.from.name === 'GEN_IMM') setWireActive(w, true);
                });
            }
        } catch (e) {}

        // PC Inc / Branch logic
        try {
            if (dbg && typeof dbg.tomarBranch !== 'undefined') {
                setModuleValue('PC_INC', [`next: 0x${(dbg.pcSiguiente>>>0).toString(16).padStart(8,'0')}`, `branch: ${dbg.tomarBranch}`]);
                setModuleActive('PC_INC', true);
                setModuleActive('BRANCH', !!dbg.tomarBranch);
            }
        } catch (e) {}
    } else {
        // no hay debug: mostramos solo estado general
        setModuleValue('REGFILE', ['Reg File', 'Active']);
        setModuleValue('MEM_DATA', ['Data Mem', 'Ready']);
    }

    visualLayer.batchDraw();
}

// Inicializar visuales al cargar la página
window.addEventListener('load', initVisualDatapath);

/* --- resto de tu app.js: botones y lógica de control adaptada para capturar debug --- */

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

    // 4. VISUAL: Actualizar Diagrama Konva (si está inicializado)
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
        const codeText = view.state.doc.toString();
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
    } catch (e) { logConsole(e.message, 'error'); }
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

    // no tenemos debug de la instrucción a la que retrocedimos -> limpiar visual
    lastDebug = null;
    updateUI();
    logConsole("Retroceso.");
});
