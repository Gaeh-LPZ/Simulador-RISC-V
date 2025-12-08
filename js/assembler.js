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
        const lines = text.split('\n'); // No filtramos aquí para conservar índices de línea
        const machineCode = [];
        const lineMap = []; // Índice instrucción -> Número de línea en editor

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Ignorar líneas vacías o comentarios
            if (line === '' || line.startsWith('#') || line.startsWith('//')) {
                continue;
            }

            try {
                // Quitamos comas extra y dividimos por espacios
                const parts = line.replace(/,/g, ' ').trim().split(/\s+/);
                const mnemonic = parts[0].toUpperCase();
                
                // Guardamos la instrucción y mapeamos su posición a la línea original (i + 1)
                machineCode.push(this._encodeInstruction(mnemonic, parts));
                lineMap.push(i + 1); 

            } catch (e) {
                throw new Error(`Error en línea ${i + 1} ("${lines[i]}"): ${e.message}`);
            }
        }
        
        // Retornamos ambas cosas
        return { machineCode, lineMap };
    }

    _parseReg(regStr) {
        if (!regStr) throw new Error("Falta registro");
        // Manejar sintaxis offset(base) para Loads/Stores ej: 0(x2)
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
        const opcodeMap = {
            'ADD':  { op: 0x33, f3: 0x0, f7: 0x00 },
            'SUB':  { op: 0x33, f3: 0x0, f7: 0x20 },
            'ADDI': { op: 0x13, f3: 0x0 },
            'LW':   { op: 0x03, f3: 0x2 },
            'SW':   { op: 0x23, f3: 0x2 },
            'BEQ':  { op: 0x63, f3: 0x0 },
            'BNE':  { op: 0x63, f3: 0x1 }
            // Agrega más instrucciones aquí según tu unidadDeControl.js
        };

        const config = opcodeMap[mnemonic];
        if (!config) throw new Error(`Instrucción no soportada: ${mnemonic}`);

        let rd, rs1, rs2, imm;

        // TIPO R (ADD rd, rs1, rs2)
        if (config.op === 0x33) {
            rd = this._parseReg(args[1]);
            rs1 = this._parseReg(args[2]);
            rs2 = this._parseReg(args[3]);
            return (config.f7 << 25) | (rs2 << 20) | (rs1 << 15) | (config.f3 << 12) | (rd << 7) | config.op;
        }

        // TIPO I (ADDI rd, rs1, imm)
        if (config.op === 0x13) {
            rd = this._parseReg(args[1]);
            rs1 = this._parseReg(args[2]);
            imm = Number(args[3]);
            return ((imm & 0xFFF) << 20) | (rs1 << 15) | (config.f3 << 12) | (rd << 7) | config.op;
        }

        // LOAD (LW rd, offset(rs1))
        if (config.op === 0x03) {
            rd = this._parseReg(args[1]);
            const memObj = this._parseReg(args[2]); // Devuelve objeto {reg, offset}
            rs1 = memObj.reg;
            imm = memObj.offset;
            return ((imm & 0xFFF) << 20) | (rs1 << 15) | (config.f3 << 12) | (rd << 7) | config.op;
        }

        // STORE (SW rs2, offset(rs1))
        if (config.op === 0x23) {
            rs2 = this._parseReg(args[1]);
            const memObj = this._parseReg(args[2]);
            rs1 = memObj.reg;
            imm = memObj.offset;
            const imm11_5 = (imm >> 5) & 0x7F;
            const imm4_0 = imm & 0x1F;
            return (imm11_5 << 25) | (rs2 << 20) | (rs1 << 15) | (config.f3 << 12) | (imm4_0 << 7) | config.op;
        }
        
        // BRANCH (BEQ rs1, rs2, imm) - Nota: Simplificado, el imm es el offset
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