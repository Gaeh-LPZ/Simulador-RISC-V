// js/assembler.js
export class Assembler {
    constructor() {
        this.regMap = {
            'zero': 0, 'ra': 1, 'sp': 2, 'gp': 3, 'tp': 4,
            't0': 5, 't1': 6, 't2': 7, 's0': 8, 'fp': 8, 's1': 9,
            'a0': 10, 'a1': 11, 'a2': 12, 'a3': 13, 'a4': 14, 'a5': 15, 'a6': 16, 'a7': 17,
            's2': 18, 's3': 19, 's4': 20, 's5': 21, 's6': 22, 's7': 23, 's8': 24, 's9': 25, 's10': 26, 's11': 27,
            't3': 28, 't4': 29, 't5': 30, 't6': 31
        };
        // Generar x0...x31
        for (let i = 0; i < 32; i++) this.regMap[`x${i}`] = i;
    }

    assemble(text) {
        const rawLines = text.split('\n');
        const machineCode = [];
        const lineMap = []; 
        
        const instructions = []; 
        const labels = {};       

        // ============================================
        // 1. PRIMERA PASADA: Limpieza y Etiquetas
        // ============================================
        let instructionCounter = 0;

        for (let i = 0; i < rawLines.length; i++) {
            let line = rawLines[i].trim();
            // Limpiar comentarios
            line = line.split('#')[0].split('//')[0].trim();

            if (!line) continue;

            // Detectar etiquetas (ej: "loop:")
            if (line.includes(':')) {
                const parts = line.split(':');
                const labelName = parts[0].trim();
                labels[labelName] = instructionCounter * 4; 
                line = parts.slice(1).join(':').trim();
            }

            if (!line) continue;

            // Parsear instrucción
            const parts = line.replace(/,/g, ' ').trim().split(/\s+/);
            const mnemonic = parts[0].toUpperCase();

            // Manejo de NOP (pseudo-instrucción para ADDI x0, x0, 0)
            if (mnemonic === 'NOP') {
                instructions.push({
                    mnemonic: 'ADDI',
                    args: ['ADDI', 'x0', 'x0', '0'],
                    originalLineIndex: i + 1,
                    address: instructionCounter * 4
                });
            } else {
                instructions.push({
                    mnemonic,
                    args: parts,
                    originalLineIndex: i + 1,
                    address: instructionCounter * 4
                });
            }

            instructionCounter++;
        }

        // ============================================
        // 2. SEGUNDA PASADA: Codificación
        // ============================================
        for (let i = 0; i < instructions.length; i++) {
            const instr = instructions[i];
            const currentPC = instr.address;

            try {
                // Resolver etiquetas para Branches (Tipo B)
                // En Tipo B, el argumento 3 (índice 3) es la etiqueta/offset
                const isBranch = ['BEQ', 'BNE', 'BLT', 'BGE', 'BLTU', 'BGEU'].includes(instr.mnemonic);

                if (isBranch) {
                    const labelTarget = instr.args[3];
                    if (isNaN(Number(labelTarget))) {
                        if (labels[labelTarget] === undefined) throw new Error(`Etiqueta "${labelTarget}" no encontrada`);
                        const offset = labels[labelTarget] - currentPC;
                        instr.args[3] = offset.toString();
                    }
                }
                
                // NOTA: Se eliminó la lógica de JUMPS (JAL/JALR) porque no están en la lista permitida.

                const code = this._encodeInstruction(instr.mnemonic, instr.args);
                machineCode.push(code);
                lineMap.push(instr.originalLineIndex);

            } catch (e) {
                throw new Error(`Error en línea ${instr.originalLineIndex} (${instr.mnemonic}): ${e.message}`);
            }
        }
        
        return { machineCode, lineMap };
    }

    _parseReg(regStr) {
        if (!regStr) throw new Error("Falta registro");
        if (regStr.includes('(')) { 
            const match = regStr.match(/^(-?\d+)\((.+)\)$/);
            if(match) return { reg: this._getRegVal(match[2]), offset: Number(match[1]) };
        }
        return this._getRegVal(regStr);
    }

    _getRegVal(str) {
        const val = this.regMap[str.toLowerCase()];
        if (val === undefined) throw new Error(`Registro inválido: ${str}`);
        return val;
    }

    _encodeInstruction(mnemonic, args) {
        // MAPA ESTRICTO SEGÚN TU COMENTARIO
        const opcodeMap = {
            // --- TIPO R (Opcode 0x33) ---
            'ADD':  { op: 0x33, f3: 0x0, f7: 0x00 },
            'SUB':  { op: 0x33, f3: 0x0, f7: 0x20 },
            'SLL':  { op: 0x33, f3: 0x1, f7: 0x00 },
            'SLT':  { op: 0x33, f3: 0x2, f7: 0x00 },
            'SLTU': { op: 0x33, f3: 0x3, f7: 0x00 },
            'XOR':  { op: 0x33, f3: 0x4, f7: 0x00 },
            'SRL':  { op: 0x33, f3: 0x5, f7: 0x00 },
            'SRA':  { op: 0x33, f3: 0x5, f7: 0x20 },
            'OR':   { op: 0x33, f3: 0x6, f7: 0x00 },
            'AND':  { op: 0x33, f3: 0x7, f7: 0x00 },

            // --- TIPO I (Opcode 0x13) ---
            'ADDI': { op: 0x13, f3: 0x0 },
            'SLLI': { op: 0x13, f3: 0x1, f7: 0x00 }, 
            'SLTI': { op: 0x13, f3: 0x2 },
            'SLTIU':{ op: 0x13, f3: 0x3 }, // Standard
            'SLTUI':{ op: 0x13, f3: 0x3 }, // Alias según comentario ("sltui")
            'XORI': { op: 0x13, f3: 0x4 },
            'SRLI': { op: 0x13, f3: 0x5, f7: 0x00 }, 
            'SRAI': { op: 0x13, f3: 0x5, f7: 0x20 }, 
            'ORI':  { op: 0x13, f3: 0x6 },
            'ANDI': { op: 0x13, f3: 0x7 },

            // --- TIPO L (Loads - Opcode 0x03) ---
            'LB':   { op: 0x03, f3: 0x0 },
            'LH':   { op: 0x03, f3: 0x1 },
            'LW':   { op: 0x03, f3: 0x2 },
            'LBU':  { op: 0x03, f3: 0x4 },
            'LHU':  { op: 0x03, f3: 0x5 },

            // --- TIPO S (Stores - Opcode 0x23) ---
            'SB':   { op: 0x23, f3: 0x0 },
            'SH':   { op: 0x23, f3: 0x1 },
            'SW':   { op: 0x23, f3: 0x2 },

            // --- TIPO B (Branches - Opcode 0x63) ---
            'BEQ':  { op: 0x63, f3: 0x0 },
            'BNE':  { op: 0x63, f3: 0x1 },
            'BLT':  { op: 0x63, f3: 0x4 },
            'BGE':  { op: 0x63, f3: 0x5 },
            'BLTU': { op: 0x63, f3: 0x6 },
            'BGEU': { op: 0x63, f3: 0x7 },
        };

        const config = opcodeMap[mnemonic];
        if (!config) throw new Error(`Instrucción no soportada o fuera del set permitido: ${mnemonic}`);

        let rd, rs1, rs2, imm;

        // CODIFICACIÓN TIPO R
        if (config.op === 0x33) {
            rd = this._parseReg(args[1]);
            rs1 = this._parseReg(args[2]);
            rs2 = this._parseReg(args[3]);
            return (config.f7 << 25) | (rs2 << 20) | (rs1 << 15) | (config.f3 << 12) | (rd << 7) | config.op;
        }

        // CODIFICACIÓN TIPO I (Incluye Loads y Aritmética Inmediata)
        if (config.op === 0x13 || config.op === 0x03) {
            rd = this._parseReg(args[1]);
            
            // Caso especial Loads: lw x1, 0(x2)
            if (config.op === 0x03 && args[2].includes('(')) {
                const memObj = this._parseReg(args[2]);
                rs1 = memObj.reg;
                imm = memObj.offset;
            } else {
                // Caso normal: addi x1, x2, 10
                rs1 = this._parseReg(args[2]);
                imm = Number(args[3]);
            }

            // Manejo especial de Shifts (SLLI, SRLI, SRAI): usan funct7
            let immEncoded = imm & 0xFFF;
            if (config.f7 !== undefined) {
                const shamt = imm & 0x1F; // shift amount 5 bits
                immEncoded = (config.f7 << 5) | shamt; 
            }

            return (immEncoded << 20) | (rs1 << 15) | (config.f3 << 12) | (rd << 7) | config.op;
        }

        // CODIFICACIÓN TIPO S
        if (config.op === 0x23) {
            rs2 = this._parseReg(args[1]);
            const memObj = this._parseReg(args[2]);
            rs1 = memObj.reg;
            imm = memObj.offset;
            const imm11_5 = (imm >> 5) & 0x7F;
            const imm4_0 = imm & 0x1F;
            return (imm11_5 << 25) | (rs2 << 20) | (rs1 << 15) | (config.f3 << 12) | (imm4_0 << 7) | config.op;
        }
        
        // CODIFICACIÓN TIPO B
        if (config.op === 0x63) {
            rs1 = this._parseReg(args[1]);
            rs2 = this._parseReg(args[2]);
            imm = Number(args[3]); 
            
            const imm12 = (imm >> 12) & 1;
            const imm10_5 = (imm >> 5) & 0x3F;
            const imm4_1 = (imm >> 1) & 0xF;
            const imm11 = (imm >> 11) & 1;
            
            return (imm12 << 31) | (imm10_5 << 25) | (rs2 << 20) | (rs1 << 15) | (config.f3 << 12) | (imm4_1 << 8) | (imm11 << 7) | config.op;
        }

        return 0; // NOP
    }
}