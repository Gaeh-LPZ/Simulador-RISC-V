/**
 * MUX de write-back al banco de registros:
 *  - Si memToReg = false -> escribe resultadoALU
 *  - Si memToReg = true  -> escribe datoMemoria
 */
export class MuxWriteBack {
    /**
     * @param {boolean} memToReg - Señal de control:
     *   false -> resultadoALU
     *   true  -> datoMemoria
     * @param {number} resultadoALU - Resultado de la ALU (32 bits)
     * @param {number} datoMemoria  - Dato leído de memoria (32 bits)
     * @returns {number} Valor a escribir en el registro destino
     */
    static seleccionar(memToReg, resultadoALU, datoMemoria) {
        if (memToReg) {
            return datoMemoria | 0;
        }
        return resultadoALU | 0;
    }
}
