import { BancoDeRegistros } from "./bancoDeRegistros.js";

class TestRunner {
    constructor() {
        this.pasados = 0;
        this.fallidos = 0;
        this.tests = [];
    }

    test(nombre, fn) {
        this.tests.push({ nombre, fn });
    }

    async ejecutar() {
        console.log('🚀 Iniciando pruebas del Banco de Registros RISC-V\n');
        
        for (const { nombre, fn } of this.tests) {
            try {
                await fn();
                console.log(`✅ ${nombre}`);
                this.pasados++;
            } catch (error) {
                console.log(`❌ ${nombre}`);
                console.error(`   Error: ${error.message}\n`);
                this.fallidos++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`📊 Resultados: ${this.pasados} pasados, ${this.fallidos} fallidos`);
        console.log('='.repeat(50));
    }
}

function assert(condicion, mensaje) {
    if (!condicion) {
        throw new Error(mensaje || 'Aserción fallida');
    }
}

function assertEqual(actual, esperado, mensaje) {
    if (actual !== esperado) {
        throw new Error(
            mensaje || `Esperado: ${esperado}, Actual: ${actual}`
        );
    }
}

// ============================================
// PRUEBAS
// ============================================

const runner = new TestRunner();

// Test 1: Inicialización
runner.test('Inicialización correcta', () => {
    const banco = new BancoDeRegistros();
    assertEqual(banco.registros.length, 32, 'Debe tener 32 registros');
    
    // Todos los registros deben iniciar en 0
    for (let i = 0; i < 32; i++) {
        assertEqual(banco.leerRegistro(i), 0, `x${i} debe iniciar en 0`);
    }
});

// Test 2: x0 siempre es 0
runner.test('x0 (zero) es hardwired a 0', () => {
    const banco = new BancoDeRegistros();
    
    // Intentar escribir en x0
    banco.escribirRegistro(0, 12345);
    assertEqual(banco.leerRegistro(0), 0, 'x0 debe permanecer en 0');
    
    // Incluso si modificamos el array directamente
    banco.registros[0] = 99999;
    assertEqual(banco.leerRegistro(0), 0, 'x0 siempre debe retornar 0');
});

// Test 3: Escritura y lectura básica
runner.test('Escritura y lectura de registros', () => {
    const banco = new BancoDeRegistros();
    
    // Escribir valores
    banco.escribirRegistro(1, 100);
    banco.escribirRegistro(10, -50);
    banco.escribirRegistro(31, 0x7FFFFFFF);
    
    // Leer y verificar
    assertEqual(banco.leerRegistro(1), 100);
    assertEqual(banco.leerRegistro(10), -50);
    assertEqual(banco.leerRegistro(31), 0x7FFFFFFF);
});

// Test 4: Lectura dual de registros
runner.test('Lectura dual de registros (rs1, rs2)', () => {
    const banco = new BancoDeRegistros();
    
    banco.escribirRegistro(5, 42);
    banco.escribirRegistro(10, 84);
    
    const { valor1, valor2 } = banco.leerRegistros(5, 10);
    
    assertEqual(valor1, 42, 'valor1 debe ser 42');
    assertEqual(valor2, 84, 'valor2 debe ser 84');
});

// Test 5: Validación de índices
runner.test('Validación de índices inválidos', () => {
    const banco = new BancoDeRegistros();
    
    const indicesInvalidos = [-1, 32, 33, 100, 'abc', null, undefined];
    
    for (const indice of indicesInvalidos) {
        try {
            banco.leerRegistro(indice);
            throw new Error(`Debería lanzar error para índice: ${indice}`);
        } catch (error) {
            assert(
                error.message.includes('inválido'),
                `Debe detectar índice inválido: ${indice}`
            );
        }
    }
});

// Test 6: Valores de 32 bits con signo
runner.test('Manejo correcto de 32 bits con signo', () => {
    const banco = new BancoDeRegistros();
    
    // Valores límite
    banco.escribirRegistro(1, 0x7FFFFFFF);  // Máximo positivo
    banco.escribirRegistro(2, -2147483648);  // Máximo negativo
    banco.escribirRegistro(3, 0xFFFFFFFF);   // -1 en complemento a 2
    
    assertEqual(banco.leerRegistro(1), 2147483647);
    assertEqual(banco.leerRegistro(2), -2147483648);
    assertEqual(banco.leerRegistro(3), -1);
});

// Test 7: Lectura por nombre ABI
runner.test('Lectura por nombre ABI', () => {
    const banco = new BancoDeRegistros();
    
    banco.escribirRegistro(1, 1000);   // ra (return address)
    banco.escribirRegistro(2, 2000);   // sp (stack pointer)
    banco.escribirRegistro(10, 3000);  // a0 (argumento/retorno)
    
    assertEqual(banco.leerPorNombre('ra'), 1000);
    assertEqual(banco.leerPorNombre('sp'), 2000);
    assertEqual(banco.leerPorNombre('a0'), 3000);
    assertEqual(banco.leerPorNombre('zero'), 0);
});

// Test 8: Reset
runner.test('Reset de registros', () => {
    const banco = new BancoDeRegistros();
    
    // Llenar con valores
    for (let i = 1; i < 32; i++) {
        banco.escribirRegistro(i, i * 100);
    }
    
    // Reset
    banco.reset();
    
    // Verificar que todos estén en 0
    for (let i = 0; i < 32; i++) {
        assertEqual(banco.leerRegistro(i), 0, `x${i} debe ser 0 después de reset`);
    }
});

// Test 9: Exportar/Importar estado
runner.test('Exportar e importar estado', () => {
    const banco1 = new BancoDeRegistros();
    
    // Configurar estado
    banco1.escribirRegistro(1, 111);
    banco1.escribirRegistro(5, 555);
    banco1.escribirRegistro(20, 2020);
    
    // Exportar
    const estado = banco1.exportarEstado();
    
    // Crear nuevo banco e importar
    const banco2 = new BancoDeRegistros();
    banco2.importarEstado(estado);
    
    // Verificar
    assertEqual(banco2.leerRegistro(1), 111);
    assertEqual(banco2.leerRegistro(5), 555);
    assertEqual(banco2.leerRegistro(20), 2020);
});

// Test 10: Simulación de instrucciones RISC-V
runner.test('Simulación de instrucciones ADD y SUB', () => {
    const banco = new BancoDeRegistros();
    
    // Simular: ADD x3, x1, x2  (x3 = x1 + x2)
    banco.escribirRegistro(1, 100);
    banco.escribirRegistro(2, 50);
    const { valor1: a, valor2: b } = banco.leerRegistros(1, 2);
    banco.escribirRegistro(3, a + b);
    
    assertEqual(banco.leerRegistro(3), 150, 'ADD debe sumar correctamente');
    
    // Simular: SUB x4, x1, x2  (x4 = x1 - x2)
    banco.escribirRegistro(4, a - b);
    assertEqual(banco.leerRegistro(4), 50, 'SUB debe restar correctamente');
});

// Test 11: Overflow de 32 bits
runner.test('Overflow en operaciones de 32 bits', () => {
    const banco = new BancoDeRegistros();
    
    // Simular overflow
    banco.escribirRegistro(1, 0x7FFFFFFF);  // Max int32
    banco.escribirRegistro(2, 1);
    
    const { valor1, valor2 } = banco.leerRegistros(1, 2);
    const resultado = (valor1 + valor2) | 0;  // Forzar 32 bits
    
    banco.escribirRegistro(3, resultado);
    
    assertEqual(banco.leerRegistro(3), -2147483648, 'Debe manejar overflow correctamente');
});

// Test 12: Registros temporales vs guardados
runner.test('Convención de registros temporales vs guardados', () => {
    const banco = new BancoDeRegistros();
    
    // Temporales: t0-t6 (x5-x7, x28-x31)
    const temporales = [5, 6, 7, 28, 29, 30, 31];
    temporales.forEach((reg, idx) => {
        banco.escribirRegistro(reg, 1000 + idx);
    });
    
    // Guardados: s0-s11 (x8-x9, x18-x27)
    const guardados = [8, 9, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
    guardados.forEach((reg, idx) => {
        banco.escribirRegistro(reg, 2000 + idx);
    });
    
    // Verificar que se escribieron correctamente
    assertEqual(banco.leerRegistro(5), 1000, 't0 debe ser 1000');
    assertEqual(banco.leerRegistro(8), 2000, 's0 debe ser 2000');
});

// ============================================
// EJECUTAR TODAS LAS PRUEBAS
// ============================================

console.clear();
runner.ejecutar().then(() => {
    console.log('\n💡 Tip: Abre la consola del navegador para ver detalles');
    
    // Demostración visual
    console.log('\n📋 Demostración visual del banco:');
    const bancoDemo = new BancoDeRegistros();
    bancoDemo.escribirRegistro(1, 42);
    bancoDemo.escribirRegistro(2, 100);
    bancoDemo.escribirRegistro(10, -50);
    bancoDemo.imprimir();
});