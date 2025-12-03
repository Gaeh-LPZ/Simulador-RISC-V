import { CPU } from './cpu.js';
import { MemoriaDePrograma } from './memoriaDePrograma.js';
import { MemoriaDeDatos } from './memoriaDeDatos.js';

const INSTR_ADDI_X1_X0_5  = 0x00500093; // addi x1,x0,5
const INSTR_ADDI_X2_X0_8  = 0x00800113; // addi x2,x0,8   (alineado)
const INSTR_ADDI_X3_X2_1  = 0x00110193; // addi x3,x2,1
const INSTR_SW_X3_0_X2    = 0x00312023; // sw x3,0(x2)
const INSTR_LW_X6_0_X2    = 0x00012303; // lw x6,0(x2)

// Aquí pones el programa que quieras probar (puedes cambiarlo a gusto)
const programa = [
  INSTR_ADDI_X1_X0_5,
  INSTR_ADDI_X2_X0_8,
  INSTR_ADDI_X3_X2_1,
  INSTR_SW_X3_0_X2,
  INSTR_LW_X6_0_X2,
];

const memProg = new MemoriaDePrograma(64);
memProg.cargarProgramaSecuencial(programa);

const memDatos = new MemoriaDeDatos(64);
const cpu = new CPU({ memoriaPrograma: memProg, memoriaDatos: memDatos });

function hex32(n) {
  return '0x' + (n >>> 0).toString(16).padStart(8, '0');
}

function printRegistros(banco) {
  const regs = banco.registros;
  console.log('--- REGISTROS ---');
  for (let i = 0; i < 32; i += 4) {
    let linea = '';
    for (let j = 0; j < 4; j++) {
      const idx = i + j;
      const valor = regs[idx];
      const hex = (valor >>> 0).toString(16).padStart(8, '0');
      linea += `x${idx.toString().padStart(2, ' ')}=${hex} (${valor.toString().padStart(3, ' ')})   `;
    }
    console.log(linea);
  }
}

function printMemoriaDatos(mem, desdeDireccion = 0, palabras = 8) {
  console.log('--- MEMORIA DE DATOS ---');
  mem.imprimir(desdeDireccion, palabras);
}

function printControl(ctrl) {
  console.log('--- CONTROL ---');
  console.log({
    opcode:  '0b' + ctrl.opcode.toString(2).padStart(7, '0'),
    funct3:  ctrl.funct3,
    funct7:  ctrl.funct7,
    rs1:     ctrl.rs1,
    rs2:     ctrl.rs2,
    rd:      ctrl.rd,
    regWrite: ctrl.regWrite,
    memRead:  ctrl.memRead,
    memWrite: ctrl.memWrite,
    memToReg: ctrl.memToReg,
    aluSrcInm: ctrl.aluSrcInm,
    branch:    ctrl.branch,
    brNeg:     ctrl.brNeg,
    jump:      ctrl.jump,
    immType:   ctrl.immType,
    aluOp:     ctrl.aluOp,
  });
}

console.log('=======================================');
console.log('      INICIO DE LA SIMULACIÓN CPU      ');
console.log('=======================================');

const ciclosMax = programa.length;

for (let i = 0; i < ciclosMax; i++) {
  console.log(`\n=========== CICLO ${i + 1} ===========`);

  const info = cpu.step();

  // 1) PC e instrucción
  console.log(`PC: ${info.pcAnterior} -> ${info.pcSiguiente}`);
  console.log('Instr:', hex32(info.instruccion));

  // 2) Control
  printControl(info.control);

  // 3) Señales de datos
  console.log('--- DATAPATH ---');
  console.log('rs1 =', info.valorRs1, 'rs2 =', info.valorRs2);
  console.log('inmediato =', info.inmediato);
  console.log('ALU opA =', info.operandoA, 'opB =', info.operandoB);
  console.log('ALU resultado =', info.resultadoALU);
  console.log('Mem dirección =', info.direccionMem);
  console.log('Mem dato leído =', info.datoMemoria);
  console.log('Branch tomado =', info.tomarBranch);

  // 4) Registros
  printRegistros(cpu.bancoRegistros);

  // 5) Memoria de datos (primeras 8 palabras)
  printMemoriaDatos(cpu.memoriaDatos, 0, 8);
}

console.log('\n=======================================');
console.log('         FIN DE LA SIMULACIÓN          ');
console.log('=======================================');
