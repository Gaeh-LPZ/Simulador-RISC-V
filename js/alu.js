// La Alu recibe el tipo de instruccion que se ejecutará
/* Recibe tanto do1 como do2 y hace la instruccion correspondiente a lo que determine el decodificador previamente realizado
 * ALU (Arithmetic Logic Unit) para arquitectura RISC-V RV32I
 * Ejecuta operaciones aritméticas y lógicas de 32 bits
 * Soporta todas las operaciones definidas en el Decoder/Control Unit
*/
export class ALU {
    constructor() {
        // Operaciones soportadas (deben coincidir con el Decoder)
        this.OPERACIONES = {
            // Aritméticas
            'ADD': this._add.bind(this),
            'SUB': this._sub.bind(this),
            
            // Lógicas
            'AND': this._and.bind(this),
            'OR': this._or.bind(this),
            'XOR': this._xor.bind(this),
            
            // Shifts
            'SLL': this._sll.bind(this),
            'SRL': this._srl.bind(this),
            'SRA': this._sra.bind(this),
            
            // Comparaciones
            'SLT': this._slt.bind(this),
            'SLTU': this._sltu.bind(this),
            
            // Comparaciones para branches (generan flag zero)
            'BEQ': this._beq.bind(this),
            'BNE': this._bne.bind(this),
            'BLT': this._blt.bind(this),
            'BGE': this._bge.bind(this),
            'BLTU': this._bltu.bind(this),
            'BGEU': this._bgeu.bind(this),
            
            // Operaciones de memoria (la ALU solo calcula dirección)
            'LW': this._add.bind(this),
            'LB': this._add.bind(this),
            'LH': this._add.bind(this),
            'LBU': this._add.bind(this),
            'LHU': this._add.bind(this),
            'SW': this._add.bind(this),
            'SB': this._add.bind(this),
            'SH': this._add.bind(this)
        };

        // Flags de estado
        this.zero = false;      // Resultado es cero
        this.negative = false;  // Resultado es negativo
        this.overflow = false;  // Hubo overflow en operación con signo
        this.carry = false;     // Hubo carry en operación sin signo
    }

    /**
     * Ejecuta una operación en la ALU
     * @param {string} operacion - Operación a ejecutar (ej: 'ADD', 'SUB', 'XOR')
     * @param {number} operando1 - Primer operando (32 bits con signo)
     * @param {number} operando2 - Segundo operando (32 bits con signo)
     * @returns {object} Resultado y flags
     */
    ejecutar(operacion, operando1, operando2) {
        // Validar operación
        if (!this.OPERACIONES[operacion]) {
            throw new Error(`Operación no soportada: ${operacion}`);
        }

        // Asegurar que los operandos sean de 32 bits con signo
        operando1 = operando1 | 0;
        operando2 = operando2 | 0;

        // Ejecutar operación
        const resultado = this.OPERACIONES[operacion](operando1, operando2);

        // Actualizar flags
        this._actualizarFlags(resultado, operando1, operando2, operacion);

        return {
            resultado: resultado,
            zero: this.zero,
            negative: this.negative,
            overflow: this.overflow,
            carry: this.carry
        };
    }

    // ============================================
    // OPERACIONES ARITMÉTICAS
    // ============================================

    _add(a, b) {
        return (a + b) | 0;
    }

    _sub(a, b) {
        return (a - b) | 0;
    }

    // ============================================
    // OPERACIONES LÓGICAS
    // ============================================

    _and(a, b) {
        return (a & b) | 0;
    }

    _or(a, b) {
        return (a | b) | 0;
    }

    _xor(a, b) {
        return (a ^ b) | 0;
    }

    // ============================================
    // OPERACIONES DE SHIFT
    // ============================================

    _sll(a, b) {
        // Shift left logical - solo usa los 5 bits menos significativos de b
        const shamt = b & 0x1F;
        return (a << shamt) | 0;
    }

    _srl(a, b) {
        // Shift right logical - shift sin signo
        const shamt = b & 0x1F;
        return (a >>> shamt) | 0;
    }

    _sra(a, b) {
        // Shift right arithmetic - shift con signo
        const shamt = b & 0x1F;
        return (a >> shamt) | 0;
    }

    // ============================================
    // OPERACIONES DE COMPARACIÓN
    // ============================================

    _slt(a, b) {
        // Set less than - comparación con signo
        return (a < b) ? 1 : 0;
    }

    _sltu(a, b) {
        // Set less than unsigned - comparación sin signo
        const ua = a >>> 0;
        const ub = b >>> 0;
        return (ua < ub) ? 1 : 0;
    }

    // ============================================
    // OPERACIONES DE BRANCH
    // ============================================

    _beq(a, b) {
        // Branch if equal - retorna 0 si son iguales (activa zero flag)
        return (a - b) | 0;
    }

    _bne(a, b) {
        // Branch if not equal - retorna 0 si son diferentes
        return (a === b) ? 0 : 1;
    }

    _blt(a, b) {
        // Branch if less than - comparación con signo
        return (a < b) ? 0 : 1;
    }

    _bge(a, b) {
        // Branch if greater or equal - comparación con signo
        return (a >= b) ? 0 : 1;
    }

    _bltu(a, b) {
        // Branch if less than unsigned
        const ua = a >>> 0;
        const ub = b >>> 0;
        return (ua < ub) ? 0 : 1;
    }

    _bgeu(a, b) {
        // Branch if greater or equal unsigned
        const ua = a >>> 0;
        const ub = b >>> 0;
        return (ua >= ub) ? 0 : 1;
    }

    // ============================================
    // ACTUALIZACIÓN DE FLAGS
    // ============================================

    _actualizarFlags(resultado, op1, op2, operacion) {
        // Flag Zero: resultado es 0
        this.zero = (resultado === 0);

        // Flag Negative: bit más significativo es 1
        this.negative = (resultado < 0);

        // Flag Overflow: detecta overflow en operaciones con signo
        if (operacion === 'ADD') {
            // Overflow si: (+) + (+) = (-) o (-) + (-) = (+)
            const signoOp1 = op1 < 0;
            const signoOp2 = op2 < 0;
            const signoRes = resultado < 0;
            this.overflow = (signoOp1 === signoOp2) && (signoOp1 !== signoRes);
        } else if (operacion === 'SUB') {
            // Overflow si: (+) - (-) = (-) o (-) - (+) = (+)
            const signoOp1 = op1 < 0;
            const signoOp2 = op2 < 0;
            const signoRes = resultado < 0;
            this.overflow = (signoOp1 !== signoOp2) && (signoOp1 !== signoRes);
        } else {
            this.overflow = false;
        }

        // Flag Carry: detecta carry en operaciones sin signo
        if (operacion === 'ADD') {
            const uop1 = op1 >>> 0;
            const uop2 = op2 >>> 0;
            const ures = resultado >>> 0;
            this.carry = (ures < uop1) || (ures < uop2);
        } else if (operacion === 'SUB') {
            const uop1 = op1 >>> 0;
            const uop2 = op2 >>> 0;
            this.carry = (uop1 < uop2);
        } else {
            this.carry = false;
        }
    }

    /**
     * Resetea todos los flags
     */
    resetFlags() {
        this.zero = false;
        this.negative = false;
        this.overflow = false;
        this.carry = false;
    }

    /**
     * Obtiene el estado actual de los flags
     * @returns {object} Estado de los flags
     */
    getFlags() {
        return {
            zero: this.zero,
            negative: this.negative,
            overflow: this.overflow,
            carry: this.carry
        };
    }

    /**
     * Imprime el resultado de una operación
     */
    imprimirResultado(operacion, op1, op2, resultado) {
        console.log('=== Resultado de ALU ===');
        console.log(`Operación: ${operacion}`);
        console.log(`Operando 1: ${op1} (0x${(op1 >>> 0).toString(16).padStart(8, '0')})`);
        console.log(`Operando 2: ${op2} (0x${(op2 >>> 0).toString(16).padStart(8, '0')})`);
        console.log(`Resultado: ${resultado.resultado} (0x${(resultado.resultado >>> 0).toString(16).padStart(8, '0')})`);
        console.log(`\nFlags:`);
        console.log(`  Zero: ${resultado.zero}`);
        console.log(`  Negative: ${resultado.negative}`);
        console.log(`  Overflow: ${resultado.overflow}`);
        console.log(`  Carry: ${resultado.carry}`);
    }

    /**
     * Lista todas las operaciones soportadas
     * @returns {array} Array con nombres de operaciones
     */
    operacionesSoportadas() {
        return Object.keys(this.OPERACIONES);
    }

    /**
     * Verifica si una operación está soportada
     * @param {string} operacion - Nombre de la operación
     * @returns {boolean} true si está soportada
     */
    esOperacionValida(operacion) {
        return operacion in this.OPERACIONES;
    }
}