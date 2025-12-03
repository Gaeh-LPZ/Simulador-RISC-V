export class ProgramCounter {
    /**
     * @param {number} valorInicial - Dirección inicial (por defecto 0)
     */
    constructor(valorInicial = 0) {
        this._pc = valorInicial | 0;
        this._pcReset = this._pc;
    }

    /** Devuelve el valor actual del PC */
    get valor() {
        return this._pc | 0;
    }

    /** Fija el PC a una dirección concreta */
    set(valor) {
        if (!Number.isInteger(valor)) {
            throw new Error(`PC debe ser entero, se recibió: ${valor}`);
        }
        this._pc = valor | 0;
    }

    /** PC = PC + incremento (normalmente 4) */
    incrementar(incremento = 4) {
        this._pc = (this._pc + (incremento | 0)) | 0;
    }

    /** Reinicia el PC al valor inicial */
    reset() {
        this._pc = this._pcReset | 0;
    }
}
