export class MemoriaDeDatos {
    /**
     * Crea una memoria de datos de N palabras de 32 bits.
     * Por defecto: 1024 palabras -> 4 KB.
     * @param {number} numeroDePalabras 
     */
    constructor(numeroDePalabras = 1024) {
        if (!Number.isInteger(numeroDePalabras) || numeroDePalabras <= 0) {
            throw new Error(`Tamaño de memoria inválido: ${numeroDePalabras}`);
        }

        this.numeroDePalabras = numeroDePalabras;
        this.memoria = new Int32Array(numeroDePalabras); // inicializada a 0
    }

    /**
     * Convierte una dirección en bytes (RISC-V) al índice de palabra.
     * Verifica alineación y límites.
     * @param {number} direccion - Dirección en bytes.
     * @returns {number} índice en el arreglo de memoria.
     */
    _direccionAIndice(direccion) {
        if (!Number.isInteger(direccion)) {
            throw new Error(`Dirección no entera: ${direccion}`);
        }

        // Debe ser múltiplo de 4 (palabra de 32 bits alineada)
        if ((direccion & 0b11) !== 0) {
            throw new Error(
                `Dirección no alineada a palabra: 0x${direccion.toString(16)} (no es múltiplo de 4)`
            );
        }

        const indice = direccion >>> 2; // dividir entre 4

        if (indice < 0 || indice >= this.numeroDePalabras) {
            throw new Error(
                `Dirección fuera de rango: 0x${direccion.toString(16)} (índice ${indice})`
            );
        }

        return indice;
    }

    /**
     * Lee una palabra de 32 bits de la memoria.
     * Equivalente a un lw (sin signo) en el hardware.
     * @param {number} direccion - Dirección en bytes (debe ser múltiplo de 4).
     * @returns {number} Valor de 32 bits con signo.
     */
    leerPalabra(direccion) {
        const indice = this._direccionAIndice(direccion);
        return this.memoria[indice];
    }

    /**
     * Escribe una palabra de 32 bits en la memoria.
     * Equivalente a un sw. Sólo escribe si writeEnable = true (señal we).
     * @param {number} direccion - Dirección en bytes (múltiplo de 4).
     * @param {number} valor - Valor a escribir (32 bits con signo).
     * @param {boolean} writeEnable - Señal de control (MemWrite / we).
     * @returns {boolean} true si se escribió, false si writeEnable estaba en false.
     */
    escribirPalabra(direccion, valor, writeEnable = true) {
        if (!writeEnable) {
            // Como en hardware: si MemWrite = 0, no se hace nada.
            return false;
        }

        const indice = this._direccionAIndice(direccion);
        this.memoria[indice] = valor | 0; // forzar a 32 bits con signo
        return true;
    }

    /**
     * Reinicia la memoria a todo ceros.
     */
    reset() {
        this.memoria.fill(0);
    }

    /**
     * Carga datos iniciales en memoria a partir de un objeto
     * { direccionEnBytes: valor, ... }.
     * Útil para poner variables o datos del programa.
     * @param {object} mapaDeDatos 
     */
    cargarDatos(mapaDeDatos) {
        for (const [dirStr, valor] of Object.entries(mapaDeDatos)) {
            const direccion = Number(dirStr);
            this.escribirPalabra(direccion, valor, true);
        }
    }

    /**
     * Imprime un rango de memoria para depuración.
     * @param {number} desdeDireccion - Dirección inicial (en bytes, múltiplo de 4).
     * @param {number} cantidadPalabras - Cuántas palabras mostrar.
     */
    imprimir(desdeDireccion = 0, cantidadPalabras = this.numeroDePalabras) {
        const inicio = this._direccionAIndice(desdeDireccion);
        const fin = Math.min(inicio + cantidadPalabras, this.numeroDePalabras);

        console.log('=== Contenido de la Memoria de Datos ===');
        for (let i = inicio; i < fin; i++) {
            const direccion = i * 4;
            const valor = this.memoria[i];
            const hex = (valor >>> 0).toString(16).padStart(8, '0');
            console.log(`0x${direccion.toString(16).padStart(4, '0')}: 0x${hex} (${valor})`);
        }
    }

    /**
     * Exporta el estado completo de la memoria (para guardar simulaciones).
     */
    exportarEstado() {
        return {
            numeroDePalabras: this.numeroDePalabras,
            memoria: Array.from(this.memoria),
            timestamp: Date.now()
        };
    }

    /**
     * Importa un estado previo de la memoria.
     * @param {object} estado 
     */
    importarEstado(estado) {
        if (!estado || !estado.memoria || !Array.isArray(estado.memoria)) {
            throw new Error('Estado de memoria inválido');
        }

        if (estado.memoria.length !== this.numeroDePalabras) {
            throw new Error(
                `Tamaño de estado (${estado.memoria.length}) no coincide con la memoria actual (${this.numeroDePalabras})`
            );
        }

        this.memoria.set(estado.memoria);
    }
}
