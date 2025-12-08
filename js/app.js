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

// ESTADO GLOBAL
let currentLineMap = [];
let cpuHistory = [];
let isProgramLoaded = false;
let playInterval = null; // Para controlar el "Play"
let currentMachineCode = []; // Guardamos el código binario actual

// DOM
const btnRun = document.getElementById('btn-run');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnPlay = document.getElementById('btn-play'); // Nuevo
const btnReset = document.getElementById('btn-reset'); // Nuevo
const consoleOut = document.getElementById('console-output');
const regContainer = document.getElementById('registers-container');
const memContainer = document.getElementById('memory-container');

// --- HELPERS ---
function logConsole(msg, type = 'info') {
    const color = type === 'error' ? 'text-red-500' : 'text-green-400';
    consoleOut.innerHTML += `<div class="${color}">> ${msg}</div>`;
    consoleOut.scrollTop = consoleOut.scrollHeight;
}

function updateUI() {
    // Registros
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

    // Memoria
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
    if (!hasData) memContainer.innerHTML = '<div class="text-gray-500">Memoria vacía</div>';

    // Resaltado
    const instructionIndex = cpu.pc.valor / 4;
    if (instructionIndex < currentLineMap.length) {
        const lineNumber = currentLineMap[instructionIndex];
        const lineInfo = view.state.doc.line(lineNumber);
        view.dispatch({ effects: setActiveLine.of(lineInfo.from) });
    } else {
        view.dispatch({ effects: setActiveLine.of(null) });
    }
}

function stopAutoPlay() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        // Opcional: Cambiar ícono de pause a play si lo tuvieras
    }
}

function softReset() {
    stopAutoPlay();
    cpu.pc.reset();
    cpu.bancoRegistros.reset();
    cpu.memoriaDatos.reset(); // Datos a cero
    cpu.ciclos = 0;
    cpuHistory = [];
    
    // Recargar el programa actual en la memoria limpia
    if (currentMachineCode.length > 0) {
        cpu.memoriaPrograma.memoria.fill(0);
        cpu.memoriaPrograma.cargarProgramaSecuencial(currentMachineCode);
    }
    
    updateUI();
}

// --- BOTONES ---

// 1. RUN: Compila y carga (Solo si es necesario)
btnRun.addEventListener('click', () => {
    // Si ya hay programa y el usuario presiona RUN, asumimos que quiere re-compilar
    // Pero si quieres que sea EXCLUSIVO, podrías poner una alerta. 
    // Por ahora, el comportamiento estándar es: RUN = "Compilar nuevo código".
    
    stopAutoPlay();
    consoleOut.innerHTML = '';
    
    try {
        const codeText = view.state.doc.toString();
        const result = assembler.assemble(codeText);
        
        currentLineMap = result.lineMap;
        currentMachineCode = result.machineCode;
        
        isProgramLoaded = true;
        
        softReset(); // Aplica el nuevo código y resetea estado
        logConsole("Código ensamblado y cargado.");

    } catch (error) {
        isProgramLoaded = false;
        logConsole(error.message, 'error');
    }
});

// 2. RESET: Reinicia la simulación actual
btnReset.addEventListener('click', () => {
    if (!isProgramLoaded) {
        logConsole("No hay programa cargado para reiniciar.", "error");
        return;
    }
    softReset();
    logConsole("Simulación reiniciada.");
});

// 3. PLAY: Ejecución continua
btnPlay.addEventListener('click', () => {
    if (!isProgramLoaded) return;
    
    // Si ya está corriendo, lo pausamos (toggle)
    if (playInterval) {
        stopAutoPlay();
        logConsole("Pausado.");
        return;
    }

    logConsole("Ejecución continua iniciada...");
    
    // Intervalo de 200ms por instrucción
    playInterval = setInterval(() => {
        const instructionIndex = cpu.pc.valor / 4;
        
        // Verificar fin de programa
        if (instructionIndex >= currentLineMap.length) {
            stopAutoPlay();
            logConsole("Fin del programa alcanzado.");
            return;
        }

        // Guardar historial para poder retroceder después
        cpuHistory.push({
            pc: cpu.pc.valor,
            ciclos: cpu.ciclos,
            regs: cpu.bancoRegistros.exportarEstado(),
            mem: cpu.memoriaDatos.exportarEstado()
        });

        try {
            cpu.step();
            updateUI();
        } catch (e) {
            stopAutoPlay();
            logConsole(`Error en ejecución: ${e.message}`, 'error');
        }

    }, 200); // Velocidad: 200ms
});

// 4. NEXT
btnNext.addEventListener('click', () => {
    if (!isProgramLoaded) return;
    stopAutoPlay(); // Pausar si se interviene manualmente

    const instructionIndex = cpu.pc.valor / 4;
    if (instructionIndex >= currentLineMap.length) return;

    cpuHistory.push({
        pc: cpu.pc.valor,
        ciclos: cpu.ciclos,
        regs: cpu.bancoRegistros.exportarEstado(),
        mem: cpu.memoriaDatos.exportarEstado()
    });

    try {
        cpu.step();
        updateUI();
    } catch (e) { logConsole(e.message, 'error'); }
});

// 5. PREV
btnPrev.addEventListener('click', () => {
    if (!isProgramLoaded || cpuHistory.length === 0) return;
    stopAutoPlay(); // Pausar si se interviene manualmente

    const state = cpuHistory.pop();
    cpu.pc.set(state.pc);
    cpu.ciclos = state.ciclos;
    cpu.bancoRegistros.importarEstado(state.regs);
    cpu.memoriaDatos.importarEstado(state.mem);
    
    updateUI();
    logConsole("Retroceso.");
});