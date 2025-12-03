/**
 * Lógica para decidir si se toma un branch.
 *
 * La ALU, para instrucciones de branch, debe devolver:
 *   resultadoALU = 1 si la condición de branch es verdadera
 *   resultadoALU = 0 si es falsa
 *
 * La unidad de control genera:
 *   - branch: true si la instrucción es un branch (BEQ, BNE, BLT, etc.)
 *   - brNeg:  true si se debe invertir la condición (ej: BNE, BGE, BGEU)
 */
export class BranchLogic {
    /**
     * Decide si se toma el branch.
     * @param {boolean} branch - Señal de control branch
     * @param {boolean} brNeg  - Señal de inversión de condición
     * @param {number} resultadoALU - Resultado de la ALU (para branch: 0 o 1)
     * @returns {boolean} true si se debe saltar (PC = PC + offset)
     */
    static debeTomarBranch(branch, brNeg, resultadoALU) {
        if (!branch) return false;

        // condición verdadera si resultadoALU != 0
        const condicion = (resultadoALU | 0) !== 0;

        // Si brNeg = false -> usamos la condición tal cual
        // Si brNeg = true  -> invertimos la condición
        return condicion !== brNeg; // equivalente a condicion XOR brNeg
    }
}
