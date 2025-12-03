import { ProgramCounter } from './programCounter.js';
import { MemoriaDePrograma } from './memoriaDePrograma.js';
import { MemoriaDeDatos } from './memoriaDeDatos.js';
import { BancoDeRegistros } from './bancoDeRegistros.js';
import { ALU } from './alu.js';
import { GeneradorInmediatos } from './generadorInmediatos.js';
import { UnidadDeControl } from './unidadDeControl.js';
import { MuxALUSrc } from './muxALUSrc.js';
import { MuxWriteBack } from './muxWriteBack.js';
import { BranchLogic } from './branchLogic.js';
import { MuxPC } from './muxPC.js';

export class CPU {
    /**
     * @param {object} opts
     * @param {MemoriaDePrograma} [opts.memoriaPrograma]
     * @param {MemoriaDeDatos} [opts.memoriaDatos]
     * @param {number} [opts.pcInicial]
     */
    constructor({ memoriaPrograma, memoriaDatos, pcInicial = 0 } = {}) {
        this.pc = new ProgramCounter(pcInicial);
        this.memoriaPrograma = memoriaPrograma || new MemoriaDePrograma();
        this.memoriaDatos = memoriaDatos || new MemoriaDeDatos();
        this.bancoRegistros = new BancoDeRegistros();
        this.alu = new ALU();
        this.ciclos = 0; // contador de pasos ejecutados
    }

    /**
     * Ejecuta UNA instrucción (un "ciclo" completo) en la CPU.
     * @returns {object} info de depuración del ciclo
     */
    step() {
        const pcActual = this.pc.valor;

        // =========================
        // 1) FETCH: leer instrucción en PC
        // =========================
        const instruccion = this.memoriaPrograma.leerInstruccion(pcActual);

        // =========================
        // 2) DECODE: unidad de control
        // =========================
        const ctrl = UnidadDeControl.decodificar(instruccion);

        // obtener inmediato si aplica
        let inmediato = 0;
        if (ctrl.immType) {
            inmediato = GeneradorInmediatos.generar(ctrl.immType, instruccion);
        }

        // leer registros fuente
        const valorRs1 = this.bancoRegistros.leerRegistro(ctrl.rs1);
        const valorRs2 = this.bancoRegistros.leerRegistro(ctrl.rs2);

        // =========================
        // 3) EXECUTE: ALU + MuxALUSrc
        //     opA puede ser rs1, PC o 0 según la instrucción
        // =========================
        let opA;

        // AUIPC: PC + immU
        if (ctrl.opcode === 0b0010111) { // AUIPC
            opA = pcActual;
        }
        // LUI: 0 + immU
        else if (ctrl.opcode === 0b0110111) { // LUI
            opA = 0;
        }
        // JAL: podemos usar PC como opA (aunque para el PC real usamos MuxPC)
        else if (ctrl.opcode === 0b1101111) { // JAL
            opA = pcActual;
        }
        // resto: ALU usa rs1 normal
        else {
            opA = valorRs1;
        }

        const operandoB = MuxALUSrc.seleccionar(ctrl.aluSrcInm, valorRs2, inmediato);

        const { resultado: resultadoALU } = this.alu.ejecutar(
            ctrl.aluOp,
            opA,
            operandoB
        );

        // =========================
        // 4) BRANCH: lógica de salto condicional
        // =========================
        const tomarBranch = BranchLogic.debeTomarBranch(
            ctrl.branch,
            ctrl.brNeg,
            resultadoALU
        );

        // =========================
        // 5) MEMORY: acceso a memoria de datos
        // =========================
        let datoMemoria = 0;

        // Dirección de memoria = resultado de la ALU (rs1 + imm) en lw/sw
        const direccionMem = resultadoALU;

        if (ctrl.memRead) {
            datoMemoria = this.memoriaDatos.leerPalabra(direccionMem);
        }

        if (ctrl.memWrite) {
            // en store, se escribe rs2 en memoria
            this.memoriaDatos.escribirPalabra(direccionMem, valorRs2, true);
        }

        // =========================
        // 6) WRITE-BACK: escribir en banco de registros
        // =========================
        if (ctrl.regWrite && ctrl.rd !== 0) {
            let valorWB;

            // JAL / JALR: rd recibe PC + 4
            if (ctrl.jump) {
                valorWB = (pcActual + 4) | 0;
            } else {
                valorWB = MuxWriteBack.seleccionar(
                    ctrl.memToReg,
                    resultadoALU,
                    datoMemoria
                );
            }

            this.bancoRegistros.escribirRegistro(ctrl.rd, valorWB);
        }

        // =========================
        // 7) PC NEXT: siguiente valor de PC (MuxPC)
        // =========================
        const esJalr = ctrl.jump && (ctrl.opcode === 0b1100111); // opcode JALR

        const pcSiguiente = MuxPC.seleccionar(
            pcActual,
            tomarBranch,
            inmediato,   // offset para branch (tipo B)
            ctrl.jump,
            esJalr,
            inmediato,   // immJ o immI (para JAL o JALR)
            valorRs1     // rs1 para JALR
        );

        this.pc.set(pcSiguiente);
        this.ciclos++;

        // =========================
        // 8) Devolvemos info de depuración (opcional)
        // =========================
        return {
            pcAnterior: pcActual,
            pcSiguiente,
            instruccion,
            control: ctrl,
            inmediato,
            valorRs1,
            valorRs2,
            operandoA: opA,
            operandoB,
            resultadoALU,
            direccionMem,
            datoMemoria,
            tomarBranch
        };
    }

    /**
     * Ejecuta N pasos (por comodidad).
     */
    runSteps(n) {
        for (let i = 0; i < n; i++) {
            this.step();
        }
    }

    /**
     * Exporta un "snapshot" del estado de la CPU
     */
    estado() {
        return {
            pc: this.pc.valor,
            ciclos: this.ciclos,
            registros: this.bancoRegistros.exportarEstado().registros
        };
    }
}
