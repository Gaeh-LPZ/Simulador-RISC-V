export const ALU_OPCODES = {
    SUMA:  0b0000, // suma
    RESTA: 0b0001, // resta
    SLL:   0b0010, // shift left logical
    SLT:   0b0011, // set less than (signed)
    SLTU:  0b0100, // set less than (unsigned)
    SEQ:   0b0101, // set if equal
    XOR:   0b1000, // xor
    SRL:   0b1010, // shift right logical
    SRA:   0b1011, // shift right arithmetic
    OR:    0b1100, // or
    AND:   0b1110  // and (en la imagen sale "land")
};

export class ALU {
    constructor() {}

    /**
     * Ejecuta una operación de la ALU
     * @param {number} opcode - Código de operación (4 bits)
     * @param {number} a - Operando 1 (32 bits con signo)
     * @param {number} b - Operando 2 (32 bits con signo)
     * @returns {{resultado:number, zero:boolean, negativo:boolean}}
     */
    ejecutar(opcode, a, b) {
        // Aseguramos que a y b sean 32 bits
        a = a | 0;
        b = b | 0;
        let res;

        switch (opcode) {
            case ALU_OPCODES.SUMA:
                res = (a + b) | 0;
                break;

            case ALU_OPCODES.RESTA:
                res = (a - b) | 0;
                break;

            case ALU_OPCODES.SLL: {
                const shamt = b & 0x1f;   // solo 5 bits
                res = (a << shamt) | 0;
                break;
            }

            case ALU_OPCODES.SLT:
                // comparación con signo
                res = (a < b) ? 1 : 0;
                break;

            case ALU_OPCODES.SLTU: {
                // comparación sin signo
                const ua = a >>> 0;
                const ub = b >>> 0;
                res = (ua < ub) ? 1 : 0;
                break;
            }

            case ALU_OPCODES.SEQ:
                res = (a === b) ? 1 : 0;
                break;

            case ALU_OPCODES.XOR:
                res = (a ^ b) | 0;
                break;

            case ALU_OPCODES.SRL: {
                const shamt = b & 0x1f;
                res = (a >>> shamt) | 0;  // lógico (rellena con 0)
                break;
            }

            case ALU_OPCODES.SRA: {
                const shamt = b & 0x1f;
                res = (a >> shamt) | 0;   // aritmético (extiende signo)
                break;
            }

            case ALU_OPCODES.OR:
                res = (a | b) | 0;
                break;

            case ALU_OPCODES.AND:
                res = (a & b) | 0;
                break;

            default:
                throw new Error(`Opcode de ALU desconocido: ${opcode}`);
        }

        return {
            resultado: res | 0,
            zero: res === 0,
            negativo: res < 0
        };
    }
}