export class BancoDeRegistros {
    constructor() {
        this.registros = new Int32Array(32);
        // x0 siempre debe ser 0 en RISC-V
        this.registros[0] = 0;
    }

    /**
     * Lee dos registros simultáneamente (lectura asíncrona típica en RISC-V)
     * @param {number} rs1 - Índice del primer registro fuente (0-31)
     * @param {number} rs2 - Índice del segundo registro fuente (0-31)
     * @returns {object} Objeto con los valores de ambos registros
     */
    leerRegistros(rs1, rs2) {
        // Validar índices
        if (!this._validarIndice(rs1) || !this._validarIndice(rs2)) {
            throw new Error(`Índices de registro inválidos: rs1=${rs1}, rs2=${rs2}`);
        }

        // En RISC-V, x0 siempre retorna 0, sin importar su contenido
        const valor1 = rs1 === 0 ? 0 : this.registros[rs1];
        const valor2 = rs2 === 0 ? 0 : this.registros[rs2];

        return { valor1, valor2 };
    }

    /**
     * Lee un solo registro
     * @param {number} rs - Índice del registro (0-31)
     * @returns {number} Valor del registro
     */
    leerRegistro(rs) {
        if (!this._validarIndice(rs)) {
            throw new Error(`Índice de registro inválido: ${rs}`);
        }
        
        return rs === 0 ? 0 : this.registros[rs];
    }

    /**
     * Escribe en un registro
     * @param {number} rd - Índice del registro destino (0-31)
     * @param {number} valor - Valor a escribir (32 bits con signo)
     * @returns {boolean} true si se escribió correctamente
     */
    escribirRegistro(rd, valor) {
        if (!this._validarIndice(rd)) {
            throw new Error(`Índice de registro inválido: ${rd}`);
        }

        // x0 es hardwired a 0, no se puede escribir
        if (rd === 0) {
            console.warn('Intento de escritura en x0 ignorado (registro hardwired a 0)');
            return false;
        }

        // Asegurar que el valor sea de 32 bits con signo
        this.registros[rd] = valor | 0;
        return true;
    }

    /**
     * Valida que un índice de registro esté en el rango válido
     * @param {number} indice - Índice a validar
     * @returns {boolean} true si es válido
     */
    _validarIndice(indice) {
        return Number.isInteger(indice) && indice >= 0 && indice < 32;
    }

    /**
     * Reinicia todos los registros a 0
     */
    reset() {
        this.registros.fill(0);
    }

    /**
     * Obtiene el valor de un registro por su nombre ABI
     * @param {string} nombre - Nombre del registro (ej: 'zero', 'ra', 'sp', 't0')
     * @returns {number} Valor del registro
     */
    leerPorNombre(nombre) {
        const nombres = {
            'zero': 0, 'ra': 1, 'sp': 2, 'gp': 3, 'tp': 4,
            't0': 5, 't1': 6, 't2': 7,
            's0': 8, 'fp': 8, 's1': 9,
            'a0': 10, 'a1': 11, 'a2': 12, 'a3': 13, 'a4': 14, 'a5': 15, 'a6': 16, 'a7': 17,
            's2': 18, 's3': 19, 's4': 20, 's5': 21, 's6': 22, 's7': 23, 's8': 24, 's9': 25, 's10': 26, 's11': 27,
            't3': 28, 't4': 29, 't5': 30, 't6': 31
        };

        const indice = nombres[nombre.toLowerCase()];
        if (indice === undefined) {
            throw new Error(`Nombre de registro desconocido: ${nombre}`);
        }

        return this.leerRegistro(indice);
    }

    /**
     * Imprime el estado actual de todos los registros
     */
    imprimir() {
        console.log('=== Estado del Banco de Registros ===');
        for (let i = 0; i < 32; i++) {
            const valor = this.registros[i];
            const hex = (valor >>> 0).toString(16).padStart(8, '0');
            console.log(`x${i.toString().padStart(2, ' ')} = 0x${hex} (${valor})`);
        }
    }

    /**
     * Exporta el estado de los registros como objeto
     * @returns {object} Estado de los registros
     */
    exportarEstado() {
        return {
            registros: Array.from(this.registros),
            timestamp: Date.now()
        };
    }

    /**
     * Importa un estado previo de los registros
     * @param {object} estado - Estado a importar
     */
    importarEstado(estado) {
        if (!estado.registros || estado.registros.length !== 32) {
            throw new Error('Estado inválido');
        }
        
        this.registros.set(estado.registros);
        this.registros[0] = 0; // Asegurar que x0 siempre sea 0
    }
}