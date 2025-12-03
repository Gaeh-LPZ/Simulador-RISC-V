// decoder.js
/* La ALU recibe el operador desde el decoder que convierte opcode, funct7 y funct3 en una cadena
   Una vez el decoder obtiene la instruccion en binario la transforma en instrucciones de tipo
   R, I, L, S o B
   instrucciones a utilizar en la ALU
   Tipo R : add, sub, and, or, xor, slt, sltu, sll, srl, sra
   Tipo I : addi, andi, ori, xori, slti, sltui, slli, srli, srai (subi es lo mismo que addi con el operando en complemento a 2)
   Tipo L : lw, lb, lh, lbu, lhu
   Tipo S : sw, sb, sh
   Tipo B : beq, bne, blt, bge, bltu, bgeu
*/

export class Decoder {
    constructor() {
        // Opcodes de RISC-V RV32I (subconjunto)
        this.OPCODES = {
            R_TYPE:    0b0110011,  // add, sub, and, or, xor, slt, sltu, sll, srl, sra
            I_TYPE:    0b0010011,  // addi, andi, ori, xori, slti, sltiu, slli, srli, srai
            LOAD:      0b0000011,  // lw, lb, lh, lbu, lhu
            STORE:     0b0100011,  // sw, sb, sh
            BRANCH:    0b1100011   // beq, bne, blt, bge, bltu, bgeu
        };

        // Mapa de operaciones ALU según funct3 y funct7
        this.OPERACIONES_ALU = {
            // Tipo R
            'R_0b000_0b0000000': 'ADD',   // add
            'R_0b000_0b0100000': 'SUB',   // sub
            'R_0b001_0b0000000': 'SLL',   // sll
            'R_0b010_0b0000000': 'SLT',   // slt
            'R_0b011_0b0000000': 'SLTU',  // sltu
            'R_0b100_0b0000000': 'XOR',   // xor
            'R_0b101_0b0000000': 'SRL',   // srl
            'R_0b101_0b0100000': 'SRA',   // sra
            'R_0b110_0b0000000': 'OR',    // or
            'R_0b111_0b0000000': 'AND',   // and

            // Tipo I (aritméticas)
            'I_0b000': 'ADD',   // addi
            'I_0b001': 'SLL',   // slli
            'I_0b010': 'SLT',   // slti
            'I_0b011': 'SLTU',  // sltiu
            'I_0b100': 'XOR',   // xori
            'I_0b101_0': 'SRL', // srli (bit[30] = 0)
            'I_0b101_1': 'SRA', // srai (bit[30] = 1)
            'I_0b110': 'OR',    // ori
            'I_0b111': 'AND',   // andi

            // Loads (funct3 especifica tamaño y signo)
            'L_0b000': 'LB',    // lb (load byte con signo)
            'L_0b001': 'LH',    // lh (load halfword con signo)
            'L_0b010': 'LW',    // lw (load word)
            'L_0b100': 'LBU',   // lbu (load byte sin signo)
            'L_0b101': 'LHU',   // lhu (load halfword sin signo)

            // Stores
            'S_0b000': 'SB',    // sb (store byte)
            'S_0b001': 'SH',    // sh (store halfword)
            'S_0b010': 'SW',    // sw (store word)

            // Branches
            'B_0b000': 'BEQ',   // beq
            'B_0b001': 'BNE',   // bne
            'B_0b100': 'BLT',   // blt
            'B_0b101': 'BGE',   // bge
            'B_0b110': 'BLTU',  // bltu
            'B_0b111': 'BGEU'   // bgeu
        };
    }

    /**
     * Decodifica una instrucción de 32 bits
     * @param {number} instruccion - Instrucción de 32 bits
     * @returns {object} Objeto con todos los campos decodificados y señales de control
     */
    decodificar(instruccion) {
        // Extraer campos básicos
        const opcode = instruccion & 0x7F;
        const rd = (instruccion >> 7) & 0x1F;
        const funct3 = (instruccion >> 12) & 0x7;
        const rs1 = (instruccion >> 15) & 0x1F;
        const rs2 = (instruccion >> 20) & 0x1F;
        const funct7 = (instruccion >> 25) & 0x7F;

        // Determinar tipo de instrucción
        const tipo = this._determinarTipo(opcode);

        // Extraer inmediato según el tipo
        const inmediato = this._extraerInmediato(instruccion, tipo);

        // Generar señales de control
        const senales = this._generarSenales(opcode, funct3, funct7, tipo);

        // Determinar operación de ALU
        const operacionALU = this._determinarOperacionALU(tipo, funct3, funct7, instruccion);

        // Obtener nombre mnemónico de la instrucción
        const mnemonico = this._obtenerMnemonico(tipo, operacionALU);

        return {
            // Campos de la instrucción
            opcode,
            rd,
            funct3,
            rs1,
            rs2,
            funct7,
            inmediato,
            tipo,
            mnemonico,
            operacionALU,

            // Señales de control
            senales: {
                regWrite: senales.regWrite,      // Escribir en registro
                aluSrc: senales.aluSrc,          // Fuente del segundo operando (0: rs2, 1: inmediato)
                memRead: senales.memRead,        // Leer de memoria
                memWrite: senales.memWrite,      // Escribir en memoria
                memToReg: senales.memToReg,      // Fuente de dato a escribir en rd (0: ALU, 1: memoria)
                branch: senales.branch,          // Es instrucción de branch
                aluOp: senales.aluOp             // Operación de ALU
            }
        };
    }

    /**
     * Determina el tipo de instrucción según el opcode
     */
    _determinarTipo(opcode) {
        switch (opcode) {
            case this.OPCODES.R_TYPE:
                return 'R';
            case this.OPCODES.I_TYPE:
                return 'I';
            case this.OPCODES.LOAD:
                return 'L';
            case this.OPCODES.STORE:
                return 'S';
            case this.OPCODES.BRANCH:
                return 'B';
            default:
                throw new Error(`Opcode no soportado: 0b${opcode.toString(2).padStart(7, '0')} (0x${opcode.toString(16)})`);
        }
    }

    /**
     * Extrae el inmediato según el tipo de instrucción
     */
    _extraerInmediato(instr, tipo) {
        switch (tipo) {
            case 'I':
            case 'L':
                // I-type: imm[11:0] = instr[31:20]
                return this._extenderSigno(instr >> 20, 12);

            case 'S':
                // S-type: imm[11:5] = instr[31:25], imm[4:0] = instr[11:7]
                const imm_s = ((instr >> 25) << 5) | ((instr >> 7) & 0x1F);
                return this._extenderSigno(imm_s, 12);

            case 'B':
                // B-type: imm[12|10:5] = instr[31:25], imm[4:1|11] = instr[11:7]
                const imm_b = ((instr >> 31) << 12) |
                             (((instr >> 7) & 0x1) << 11) |
                             (((instr >> 25) & 0x3F) << 5) |
                             (((instr >> 8) & 0xF) << 1);
                return this._extenderSigno(imm_b, 13);

            case 'R':
                // Tipo R no tiene inmediato
                return 0;

            default:
                return 0;
        }
    }

    /**
     * Extiende el signo de un número de n bits a 32 bits
     */
    _extenderSigno(valor, bits) {
        const mascara = 1 << (bits - 1);
        if (valor & mascara) {
            // Si el bit de signo está en 1, extender con 1s
            return valor | (~0 << bits);
        }
        return valor;
    }

    /**
     * Determina la operación de ALU
     */
    _determinarOperacionALU(tipo, funct3, funct7, instr) {
        let clave;

        switch (tipo) {
            case 'R':
                clave = `R_${this._toBin(funct3, 3)}_${this._toBin(funct7, 7)}`;
                break;

            case 'I':
                // Para shifts, considerar bit[30] para distinguir lógico de aritmético
                if (funct3 === 0b001 || funct3 === 0b101) {
                    const bit30 = (instr >> 30) & 0x1;
                    clave = `I_${this._toBin(funct3, 3)}_${bit30}`;
                } else {
                    clave = `I_${this._toBin(funct3, 3)}`;
                }
                break;

            case 'L':
                clave = `L_${this._toBin(funct3, 3)}`;
                break;

            case 'S':
                clave = `S_${this._toBin(funct3, 3)}`;
                break;

            case 'B':
                clave = `B_${this._toBin(funct3, 3)}`;
                break;

            default:
                return 'NONE';
        }

        const operacion = this.OPERACIONES_ALU[clave];
        if (!operacion) {
            throw new Error(`Operación no reconocida para ${clave}`);
        }
        return operacion;
    }

    /**
     * Genera señales de control según el tipo de instrucción
     */
    _generarSenales(opcode, funct3, funct7, tipo) {
        const senales = {
            regWrite: false,
            aluSrc: false,
            memRead: false,
            memWrite: false,
            memToReg: false,
            branch: false,
            aluOp: null
        };

        switch (tipo) {
            case 'R':
                senales.regWrite = true;
                senales.aluSrc = false;  // Operando viene de rs2
                senales.aluOp = 'R';
                break;

            case 'I':
                senales.regWrite = true;
                senales.aluSrc = true;   // Operando viene de inmediato
                senales.aluOp = 'I';
                break;

            case 'L':
                senales.regWrite = true;
                senales.aluSrc = true;
                senales.memRead = true;
                senales.memToReg = true; // Dato viene de memoria
                senales.aluOp = 'ADD';   // ALU suma dirección base + offset
                break;

            case 'S':
                senales.aluSrc = true;
                senales.memWrite = true;
                senales.aluOp = 'ADD';   // ALU suma dirección base + offset
                break;

            case 'B':
                senales.branch = true;
                senales.aluOp = 'SUB';   // ALU resta para comparación
                break;
        }

        return senales;
    }

    /**
     * Obtiene el mnemónico (nombre) de la instrucción
     */
    _obtenerMnemonico(tipo, operacionALU) {
        if (tipo === 'R') {
            return operacionALU.toLowerCase();
        } else if (tipo === 'I') {
            return operacionALU.toLowerCase() + 'i';
        } else if (tipo === 'L' || tipo === 'S' || tipo === 'B') {
            return operacionALU.toLowerCase();
        }
        return 'unknown';
    }

    /**
     * Convierte número a binario con prefijo 0b
     */
    _toBin(num, bits) {
        return '0b' + num.toString(2).padStart(bits, '0');
    }

    /**
     * Imprime la instrucción decodificada de forma legible
     */
    imprimir(resultado) {
        console.log('=== Instrucción Decodificada ===');
        console.log(`Tipo: ${resultado.tipo}`);
        console.log(`Mnemónico: ${resultado.mnemonico}`);
        console.log(`Operación ALU: ${resultado.operacionALU}`);
        console.log(`\nCampos:`);
        console.log(`  opcode: 0b${resultado.opcode.toString(2).padStart(7, '0')}`);
        console.log(`  rd: x${resultado.rd}`);
        console.log(`  rs1: x${resultado.rs1}`);
        console.log(`  rs2: x${resultado.rs2}`);
        console.log(`  funct3: 0b${resultado.funct3.toString(2).padStart(3, '0')}`);
        console.log(`  funct7: 0b${resultado.funct7.toString(2).padStart(7, '0')}`);
        console.log(`  inmediato: ${resultado.inmediato} (0x${(resultado.inmediato >>> 0).toString(16)})`);
        console.log(`\nSeñales de Control:`);
        for (const [senal, valor] of Object.entries(resultado.senales)) {
            console.log(`  ${senal}: ${valor}`);
        }
    }

    /**
     * Valida si una instrucción es válida para este decoder
     * @param {number} instruccion - Instrucción de 32 bits
     * @returns {boolean} true si es válida
     */
    esInstruccionValida(instruccion) {
        try {
            const opcode = instruccion & 0x7F;
            return Object.values(this.OPCODES).includes(opcode);
        } catch {
            return false;
        }
    }
}