/* * MUX que selecciona el segundo operando de la ALU:
 *  - Si aluSrcInm = false -> usa valorRegistro (rs2)
 *  - Si aluSrcInm = true  -> usa valorInmediato
 */
export class MuxALUSrc {
    /**
     * @param {boolean} aluSrcInm - Señal de control (false: rs2, true: inmediato)
     * @param {number} valorRegistro - Valor de rs2 (32 bits)
     * @param {number} valorInmediato - Inmediato extendido (32 bits)
     * @returns {number} Operando B para la ALU
     */
    static seleccionar(aluSrcInm, valorRegistro, valorInmediato) {
        if (aluSrcInm) {
            return valorInmediato | 0;
        }
        return valorRegistro | 0;
    }
}
