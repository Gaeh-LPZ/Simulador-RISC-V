// Tipos de inmediato RISC-V que vamos a soportar
export const TIPOS_INM = {
    I: 'I',
    S: 'S',
    B: 'B',
    U: 'U',
    J: 'J'
};

export class GeneradorInmediatos {
    /**
     * Extiende un valor de n bits a 32 bits con signo.
     * @param {number} valor - Valor a extender (sin signo).
     * @param {number} bits  - Número de bits significativos (5, 12, 13, 21, etc.)
     * @returns {number} valor de 32 bits con signo
     */
    static _signExtend(valor, bits) {
        const shift = 32 - bits;
        return (valor << shift) >> shift;
    }

    /**
     * Inmediato tipo I (ej: addi, lw)
     * imm[11:0] = inst[31:20]
     */
    static inmediatoTipoI(instruccion) {
        const imm12 = (instruccion >>> 20) & 0xfff; // 12 bits
        return this._signExtend(imm12, 12);
    }

    /**
     * Inmediato tipo S (ej: sw)
     * imm[11:5] = inst[31:25], imm[4:0] = inst[11:7]
     */
    static inmediatoTipoS(instruccion) {
        const imm11_5 = (instruccion >>> 25) & 0x7f;  // 7 bits
        const imm4_0  = (instruccion >>> 7)  & 0x1f;  // 5 bits
        const imm12   = (imm11_5 << 5) | imm4_0;      // 12 bits
        return this._signExtend(imm12, 12);
    }

    /**
     * Inmediato tipo B (branches: beq, bne, ...)
     * imm[12]   = inst[31]
     * imm[10:5] = inst[30:25]
     * imm[4:1]  = inst[11:8]
     * imm[11]   = inst[7]
     * imm[0]    = 0
     */
    static inmediatoTipoB(instruccion) {
        const bit12   = (instruccion >>> 31) & 0x1;
        const bits10_5 = (instruccion >>> 25) & 0x3f;
        const bits4_1  = (instruccion >>> 8)  & 0x0f;
        const bit11   = (instruccion >>> 7)  & 0x1;

        let imm = 0;
        imm |= (bit12   << 12);
        imm |= (bit11   << 11);
        imm |= (bits10_5 << 5);
        imm |= (bits4_1  << 1);
        // imm[0] = 0 (ya lo está)

        // Son 13 bits significativos (12..0)
        return this._signExtend(imm, 13);
    }

    /**
     * Inmediato tipo U (LUI / AUIPC)
     * imm[31:12] = inst[31:12], imm[11:0] = 0
     */
    static inmediatoTipoU(instruccion) {
        const imm = instruccion & 0xfffff000; // ya está alineado, parte baja 0
        // Aquí realmente ya es el valor final, pero lo pasamos por signExtend por simetría.
        return this._signExtend(imm, 32);
    }

    /**
     * Inmediato tipo J (JAL)
     * imm[20]   = inst[31]
     * imm[10:1] = inst[30:21]
     * imm[11]   = inst[20]
     * imm[19:12]= inst[19:12]
     * imm[0]    = 0
     */
    static inmediatoTipoJ(instruccion) {
        const bit20     = (instruccion >>> 31) & 0x1;
        const bits10_1  = (instruccion >>> 21) & 0x3ff;
        const bit11     = (instruccion >>> 20) & 0x1;
        const bits19_12 = (instruccion >>> 12) & 0xff;

        let imm = 0;
        imm |= (bit20     << 20);
        imm |= (bits19_12 << 12);
        imm |= (bit11     << 11);
        imm |= (bits10_1  << 1);
        // imm[0] = 0

        // 21 bits significativos (20..0)
        return this._signExtend(imm, 21);
    }

    /**
     * Interfaz genérica: le pasas el tipo (I,S,B,U,J) y la instrucción,
     * y te devuelve el inmediato correspondiente.
     */
    static generar(tipo, instruccion) {
        switch (tipo) {
            case TIPOS_INM.I: return this.inmediatoTipoI(instruccion);
            case TIPOS_INM.S: return this.inmediatoTipoS(instruccion);
            case TIPOS_INM.B: return this.inmediatoTipoB(instruccion);
            case TIPOS_INM.U: return this.inmediatoTipoU(instruccion);
            case TIPOS_INM.J: return this.inmediatoTipoJ(instruccion);
            default:
                throw new Error(`Tipo de inmediato desconocido: ${tipo}`);
        }
    }
}
