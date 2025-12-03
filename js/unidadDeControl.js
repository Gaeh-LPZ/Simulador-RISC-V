import { ALU_OPCODES } from './alu.js';
import { TIPOS_INM } from './generadorInmediatos.js';

export class UnidadDeControl {
    /**
     * Decodifica una instrucción RISC-V de 32 bits y genera las señales de control.
     * @param {number} instruccion - Entero de 32 bits (sin signo)
     * @returns {object} señales de control + campos decodificados
     */
    static decodificar(instruccion) {
        instruccion = instruccion >>> 0;

        const opcode = instruccion & 0x7f;
        const rd     = (instruccion >>> 7)  & 0x1f;
        const funct3 = (instruccion >>> 12) & 0x7;
        const rs1    = (instruccion >>> 15) & 0x1f;
        const rs2    = (instruccion >>> 20) & 0x1f;
        const funct7 = (instruccion >>> 25) & 0x7f;

        // Valores por defecto (NOP)
        let regWrite   = false;
        let memRead    = false;
        let memWrite   = false;
        let memToReg   = false; // false => resultado ALU, true => dato memoria
        let aluSrcInm  = false; // false => rs2, true => inmediato
        let branch     = false; // indica que es instrucción de branch
        let brNeg      = false; // para invertir condición (ej. BNE, BGE)
        let jump       = false; // JAL / JALR
        let immType    = null;  // uno de TIPOS_INM
        let aluOp      = ALU_OPCODES.SUMA; // por defecto suma

        switch (opcode) {
            // =========================
            // R-TYPE: 0110011
            // =========================
            case 0b0110011: {
                regWrite = true;
                aluSrcInm = false;
                memRead = false;
                memWrite = false;
                memToReg = false;
                immType = null;

                if (funct3 === 0b000 && funct7 === 0b0000000) {
                    // ADD
                    aluOp = ALU_OPCODES.SUMA;
                } else if (funct3 === 0b000 && funct7 === 0b0100000) {
                    // SUB
                    aluOp = ALU_OPCODES.RESTA;
                } else if (funct3 === 0b111 && funct7 === 0b0000000) {
                    // AND
                    aluOp = ALU_OPCODES.AND;
                } else if (funct3 === 0b110 && funct7 === 0b0000000) {
                    // OR
                    aluOp = ALU_OPCODES.OR;
                } else if (funct3 === 0b100 && funct7 === 0b0000000) {
                    // XOR
                    aluOp = ALU_OPCODES.XOR;
                } else if (funct3 === 0b010 && funct7 === 0b0000000) {
                    // SLT
                    aluOp = ALU_OPCODES.SLT;
                } else if (funct3 === 0b011 && funct7 === 0b0000000) {
                    // SLTU
                    aluOp = ALU_OPCODES.SLTU;
                } else if (funct3 === 0b001 && funct7 === 0b0000000) {
                    // SLL
                    aluOp = ALU_OPCODES.SLL;
                } else if (funct3 === 0b101 && funct7 === 0b0000000) {
                    // SRL
                    aluOp = ALU_OPCODES.SRL;
                } else if (funct3 === 0b101 && funct7 === 0b0100000) {
                    // SRA
                    aluOp = ALU_OPCODES.SRA;
                } else {
                    throw new Error(`Instrucción R-type desconocida: funct3=${funct3}, funct7=${funct7}`);
                }
                break;
            }

            // =========================
            // I-TYPE ALU: 0010011 (addi, andi, ori, etc.)
            // =========================
            case 0b0010011: {
                regWrite = true;
                aluSrcInm = true;
                memRead = false;
                memWrite = false;
                memToReg = false;
                immType = TIPOS_INM.I;

                if (funct3 === 0b000) {
                    // ADDI
                    aluOp = ALU_OPCODES.SUMA;
                } else if (funct3 === 0b111) {
                    // ANDI
                    aluOp = ALU_OPCODES.AND;
                } else if (funct3 === 0b110) {
                    // ORI
                    aluOp = ALU_OPCODES.OR;
                } else if (funct3 === 0b100) {
                    // XORI
                    aluOp = ALU_OPCODES.XOR;
                } else if (funct3 === 0b010) {
                    // SLTI
                    aluOp = ALU_OPCODES.SLT;
                } else if (funct3 === 0b011) {
                    // SLTIU
                    aluOp = ALU_OPCODES.SLTU;
                } else if (funct3 === 0b001 && funct7 === 0b0000000) {
                    // SLLI
                    aluOp = ALU_OPCODES.SLL;
                } else if (funct3 === 0b101 && funct7 === 0b0000000) {
                    // SRLI
                    aluOp = ALU_OPCODES.SRL;
                } else if (funct3 === 0b101 && funct7 === 0b0100000) {
                    // SRAI
                    aluOp = ALU_OPCODES.SRA;
                } else {
                    throw new Error(`Instrucción I-ALU desconocida: funct3=${funct3}, funct7=${funct7}`);
                }
                break;
            }

            // =========================
            // LOAD: 0000011 (LW, LH, LB, etc.)
            // =========================
            case 0b0000011: {
                // Para simplificar, lo tratamos como LW
                regWrite = true;
                memRead = true;
                memWrite = false;
                memToReg = true;   // dato viene de memoria
                aluSrcInm = true;  // base + offset
                immType = TIPOS_INM.I;
                aluOp = ALU_OPCODES.SUMA; // dirección = rs1 + imm
                break;
            }

            // =========================
            // STORE: 0100011 (SW, SH, SB)
            // =========================
            case 0b0100011: {
                regWrite = false;
                memRead = false;
                memWrite = true;
                memToReg = false;
                aluSrcInm = true;      // base + offset
                immType = TIPOS_INM.S;
                aluOp = ALU_OPCODES.SUMA; // dirección = rs1 + imm
                break;
            }

            // =========================
            // BRANCH: 1100011 (BEQ, BNE, BLT, BGE, BLTU, BGEU)
            // =========================
            case 0b1100011: {
                regWrite = false;
                memRead = false;
                memWrite = false;
                memToReg = false;
                aluSrcInm = false; // se usan rs1 y rs2
                branch = true;
                immType = TIPOS_INM.B;

                switch (funct3) {
                    case 0b000: // BEQ
                        aluOp = ALU_OPCODES.SEQ; // 1 si iguales
                        brNeg = false;           // tomar branch si resultado==1
                        break;
                    case 0b001: // BNE
                        aluOp = ALU_OPCODES.SEQ; // 1 si iguales
                        brNeg = true;            // tomar branch si resultado==0
                        break;
                    case 0b100: // BLT
                        aluOp = ALU_OPCODES.SLT; // 1 si rs1<rs2 (signed)
                        brNeg = false;
                        break;
                    case 0b101: // BGE
                        aluOp = ALU_OPCODES.SLT; // 1 si rs1<rs2 (signed)
                        brNeg = true;            // branch si NO (rs1<rs2)
                        break;
                    case 0b110: // BLTU
                        aluOp = ALU_OPCODES.SLTU; // 1 si rs1<rs2 (unsigned)
                        brNeg = false;
                        break;
                    case 0b111: // BGEU
                        aluOp = ALU_OPCODES.SLTU;
                        brNeg = true;
                        break;
                    default:
                        throw new Error(`Branch desconocido: funct3=${funct3}`);
                }
                break;
            }

            // =========================
            // LUI: 0110111
            // =========================
            case 0b0110111: {
                regWrite = true;
                memRead = false;
                memWrite = false;
                memToReg = false;
                aluSrcInm = true;
                immType = TIPOS_INM.U;
                // Para LUI: rd = immU, ALU puede simplemente pasar el operando B
                // pero aquí lo modelamos como SUMA con rs1=0 + immU
                aluOp = ALU_OPCODES.SUMA;
                break;
            }

            // =========================
            // AUIPC: 0010111
            // =========================
            case 0b0010111: {
                regWrite = true;
                memRead = false;
                memWrite = false;
                memToReg = false;
                aluSrcInm = true;  // PC + immU (en tu datapath el PC será una entrada)
                immType = TIPOS_INM.U;
                aluOp = ALU_OPCODES.SUMA;
                break;
            }

            // =========================
            // JAL: 1101111
            // =========================
            case 0b1101111: {
                regWrite = true;      // escribe PC+4 en rd
                memRead = false;
                memWrite = false;
                memToReg = false;     // normalmente se mete PC+4 por otro camino
                aluSrcInm = true;     // para calcular destino PC + immJ
                branch = false;
                brNeg = false;
                jump = true;
                immType = TIPOS_INM.J;
                aluOp = ALU_OPCODES.SUMA;
                break;
            }

            // =========================
            // JALR: 1100111 (I-type)
            // =========================
            case 0b1100111: {
                // Usaremos solo jalr con funct3 = 000
                if (funct3 !== 0b000) {
                    throw new Error(`JALR con funct3 != 000 no soportado: funct3=${funct3}`);
                }

                regWrite = true;   // escribe PC+4 en rd
                memRead = false;
                memWrite = false;
                memToReg = false;
                aluSrcInm = true;  // rs1 + immI
                branch = false;
                brNeg = false;
                jump = true;
                immType = TIPOS_INM.I;
                aluOp = ALU_OPCODES.SUMA;
                break;
            }

            // =========================
            // NOP / instrucción desconocida
            // =========================
            default:
                throw new Error(`Opcode desconocido: 0x${opcode.toString(16)}`);
        }

        return {
            opcode,
            funct3,
            funct7,
            rd,
            rs1,
            rs2,

            regWrite,
            memRead,
            memWrite,
            memToReg,
            aluSrcInm,
            branch,
            brNeg,
            jump,
            immType,
            aluOp
        };
    }
}
