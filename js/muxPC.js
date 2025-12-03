/**
 * MUX del siguiente PC.
 *
 * Decide el nuevo valor del PC considerando:
 *  - ejecución normal           → PC + 4
 *  - branch tomado              → PC + offset
 *  - JAL (salto relativo)       → PC + immJ
 *  - JALR (salto indirecto)     → (rs1 + immI) & ~1
 */
export class MuxPC {
    /**
     * @param {number} pcActual      - Valor actual del PC
     * @param {boolean} tomarBranch  - Si la lógica de branch indica que hay que saltar
     * @param {number} offsetBranch  - Inmediato tipo B (ya extendido)
     * @param {boolean} jump         - Señal de la CU para JAL o JALR
     * @param {boolean} jalr         - true si es JALR
     * @param {number} inmediato     - Inmediato extendido (I o J)
     * @param {number} valorRs1      - Valor de rs1 (solo para JALR)
     * @returns {number} el nuevo PC (PC_next)
     */
    static seleccionar(pcActual, tomarBranch, offsetBranch, jump, jalr, inmediato, valorRs1) {
        pcActual  = pcActual  | 0;
        offsetBranch = offsetBranch | 0;
        inmediato = inmediato | 0;

        // Caso JALR (salto indirecto)
        if (jump && jalr) {
            // (rs1 + immI) con bit 0 forzado a 0
            return ((valorRs1 + inmediato) & ~1) | 0;
        }

        // Caso JAL (salto relativo)
        if (jump && !jalr) {
            return (pcActual + inmediato) | 0;
        }

        // Caso branch tomado
        if (tomarBranch) {
            return (pcActual + offsetBranch) | 0;
        }

        // Ejecución normal
        return (pcActual + 4) | 0;
    }
}
