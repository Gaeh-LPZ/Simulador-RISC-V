export class MemoriaDePrograma {
    /**
     * Memoria de instrucciones de 32 bits.
     * @param {number} numeroDePalabras - Cantidad de instrucciones (palabras de 32 bits)
     */
    constructor(numeroDePalabras = 1024) {
        if (!Number.isInteger(numeroDePalabras) || numeroDePalabras <= 0) {
            throw new Error(`Tamaño de memoria de programa inválido: ${numeroDePalabras}`);
        }

        this.numeroDePalabras = numeroDePalabras;
        // Instrucciones tratadas como 32 bits sin signo
        this.memoria = new Uint32Array(numeroDePalabras);
    }

    /**
     * Convierte dirección en bytes (PC) a índice de palabra.
     */
    _direccionAIndice(direccion) {
        if (!Number.isInteger(direccion)) {
            throw new Error(`Dirección de instrucción no entera: ${direccion}`);
        }

        if ((direccion & 0b11) !== 0) {
            throw new Error(
                `Dirección de instrucción no alineada: 0x${direccion.toString(16)}`
            );
        }

        const indice = direccion >>> 2; // /4

        if (indice < 0 || indice >= this.numeroDePalabras) {
            throw new Error(
                `Dirección de instrucción fuera de rango: 0x${direccion.toString(16)} (índice ${indice})`
            );
        }

        return indice;
    }

    /**
     * Lee la instrucción en la dirección dada (PC).
     * @param {number} direccion - Dirección en bytes.
     * @returns {number} instrucción de 32 bits (sin signo).
     */
    leerInstruccion(direccion) {
        const indice = this._direccionAIndice(direccion);
        return this.memoria[indice] >>> 0;
    }

    /**
     * Carga un array de instrucciones secuencialmente desde la dirección 0.
     * @param {number[]} instrucciones - Array de enteros de 32 bits.
     */
    cargarProgramaSecuencial(instrucciones) {
        if (instrucciones.length > this.numeroDePalabras) {
            throw new Error('Programa demasiado grande para la memoria de programa');
        }

        for (let i = 0; i < instrucciones.length; i++) {
            this.memoria[i] = instrucciones[i] >>> 0;
        }
    }

    /**
     * Carga instrucciones en direcciones específicas: { direccionEnBytes: instrucción }
     */
    cargarProgramaPorDirecciones(mapa) {
        for (const [dirStr, instr] of Object.entries(mapa)) {
            const direccion = Number(dirStr);
            const indice = this._direccionAIndice(direccion);
            this.memoria[indice] = instr >>> 0;
        }
    }

    /**
     * Solo para depuración.
     */
    imprimir(desdeDireccion = 0, cantidadPalabras = this.numeroDePalabras) {
        const inicio = this._direccionAIndice(desdeDireccion);
        const fin = Math.min(inicio + cantidadPalabras, this.numeroDePalabras);

        console.log('=== Memoria de Programa ===');
        for (let i = inicio; i < fin; i++) {
            const direccion = i * 4;
            const instr = this.memoria[i] >>> 0;
            const hex = instr.toString(16).padStart(8, '0');
            console.log(`0x${direccion.toString(16).padStart(4, '0')}: 0x${hex}`);
        }
    }
}
