// elements/TopDatapath.js

(function (global) {
  function createTopDatapath(params) {
    const { layer } = params || {};

    if (!layer) {
      throw new Error('TopDatapath.create: necesitas pasar { layer }');
    }

    const root = new Konva.Group();
    layer.add(root);

    // Grupos para capas (Wires abajo, Módulos arriba)
    const wiresGroup = new Konva.Group();
    const modulesGroup = new Konva.Group();
    root.add(wiresGroup);
    root.add(modulesGroup);

    // =========================
    // 1. GRID Y LAYOUT (Espaciado Mejorado)
    // =========================
    const SCALE = 0.8;
    const MOD_W = 160 * SCALE; // ~120 ancho modulo
    const MOD_H = 260 * SCALE; // ~195 alto modulo

    // Aumentamos los gaps para que quepan los cables sin pisar módulos
    const COL_GAP = 80; 
    const ROW_GAP = 140; // Mucho espacio en medio para la "Autopista"

    const x0 = 50;
    const x1 = x0 + MOD_W + COL_GAP;
    const x2 = x1 + MOD_W + COL_GAP;
    const x3 = x2 + MOD_W + COL_GAP;
    const x4 = x3 + MOD_W + COL_GAP;
    const x5 = x4 + MOD_W + COL_GAP;

    const yRow1 = 50;                     // Fila Superior
    const yRow2 = yRow1 + MOD_H + ROW_GAP; // Fila Inferior

    function pos(x, y) { return { x, y }; }

    // Helpers para crear cajas
    function makeBox(x, y) {
      return { l: x, r: x + MOD_W, t: y, b: y + MOD_H, cx: x + MOD_W/2, cy: y + MOD_H/2 };
    }

    // --- INSTANCIACIÓN DE MÓDULOS ---
    
    // Fila 1 (Superior): MemProg -> GenImm -> Banco -> MuxSrc -> ALU -> MemDatos
    const boxMemProg  = makeBox(x0, yRow1);
    const boxGenImm   = makeBox(x1, yRow1);
    const boxBanco    = makeBox(x2, yRow1);
    const boxMuxSrc   = makeBox(x3, yRow1);
    const boxAlu      = makeBox(x4, yRow1);
    const boxMemDatos = makeBox(x5, yRow1);

    // Fila 2 (Inferior): PC -> PCInc -> UControl -> MuxWB -> BranchLogic
    const boxPC       = makeBox(x0, yRow2);
    const boxPCInc    = makeBox(x1, yRow2);
    const boxUCtrl    = makeBox(x2, yRow2);
    const boxMuxWB    = makeBox(x3, yRow2);
    const boxBrLogic  = makeBox(x4, yRow2);

    function addMod(Factory, p, box) {
      const m = Factory.create({ ...p, scale: SCALE });
      modulesGroup.add(m.group);
      m.box = box; 
      return m;
    }

    const memProg     = addMod(MemoriaDeProgramaModule, pos(x0, yRow1), boxMemProg);
    const genImm      = addMod(GeneradorInmediatosModule, pos(x1, yRow1), boxGenImm);
    const banco       = addMod(BancoDeRegistrosModule,    pos(x2, yRow1), boxBanco);
    const muxALUSrc   = addMod(MuxALUSrcModule,           pos(x3, yRow1), boxMuxSrc);
    const alu         = addMod(ALUModule,                 pos(x4, yRow1), boxAlu);
    const memDatos    = addMod(MemoriaDeDatosModule,      pos(x5, yRow1), boxMemDatos);

    const pcMod       = addMod(ProgramCounterModule,      pos(x0, yRow2), boxPC);
    const pcInc       = addMod(PCIncrementBranchModule,   pos(x1, yRow2), boxPCInc);
    const uControl    = addMod(UnidadDeControlModule,     pos(x2, yRow2), boxUCtrl);
    const muxALU2REG  = addMod(MuxALU2REGModule,          pos(x3, yRow2), boxMuxWB);
    const branchLogic = addMod(BranchLogicModule,         pos(x4, yRow2), boxBrLogic);

    const allModules = [pcMod, pcInc, memProg, genImm, uControl, banco, muxALUSrc, alu, memDatos, muxALU2REG, branchLogic];
    allModules.forEach(m => m.group.opacity(1)); // Inactivos por defecto

    // =========================
    // 2. SISTEMA DE RUTEO DE CABLES
    // =========================

    // Estilos
    const S_DATA = { stroke: '#4a4a4a', strokeWidth: 2, lineCap: 'round', lineJoin: 'round' };
    const S_CTRL = { stroke: '#e08600', strokeWidth: 1.5, dash: [4, 4] };

    /**
     * Dibuja un cable ortogonal (Manhattan) evitando colisiones simples.
     * @param {Object} fromMod - Módulo origen
     * @param {Number} outIdx - Índice conector salida
     * @param {Object} toMod - Módulo destino
     * @param {Number} inIdx - Índice conector entrada
     * @param {Number} channelY - Altura Y por donde viajará el cable horizontalmente
     * @param {Object} style - Estilo de línea
     * @param {Number} offsetExit - (Opcional) Desplazamiento X al salir para no encimar líneas verticales
     */
    function wire(fromMod, outIdx, toMod, inIdx, channelY, style, offsetExit = 20) {
      const p1 = fromMod.getOutputConnectorPosition(outIdx);
      const p2 = toMod.getInputConnectorPosition(inIdx);
      const b1 = fromMod.box;
      const b2 = toMod.box;

      // Puntos clave
      // 1. Salir del módulo un poco hacia la derecha
      const xExit = b1.r + offsetExit;
      
      // 2. Entrar al módulo un poco desde la izquierda
      const xEnter = b2.l - offsetExit;

      // Construcción del path
      const points = [
        p1.x, p1.y,       // Inicio
        xExit, p1.y,      // Salida recta
        xExit, channelY,  // Subir/Bajar al carril
        xEnter, channelY, // Viajar horizontal hasta destino
        xEnter, p2.y,     // Subir/Bajar al pin de entrada
        p2.x, p2.y        // Conectar
      ];

      // Optimización visual: Si el destino está justo a la derecha y al mismo nivel, línea recta
      // (Pero aquí preferimos el "channel" para que se vea ordenado)

      const line = new Konva.Line({
        points: points,
        ...style,
        // Flecha al final
        pointerLength: 6,
        pointerWidth: 6,
        pointerAtEnding: true
      });
      wiresGroup.add(line);
    }

    // Versión simplificada para conectar dos puntos cercanos sin ir a un carril global
    function wireDirect(fromMod, outIdx, toMod, inIdx, style) {
      const p1 = fromMod.getOutputConnectorPosition(outIdx);
      const p2 = toMod.getInputConnectorPosition(inIdx);
      // Punto medio
      const midX = (p1.x + p2.x) / 2;
      
      wiresGroup.add(new Konva.Line({
        points: [p1.x, p1.y, midX, p1.y, midX, p2.y, p2.x, p2.y],
        ...style,
        pointerLength: 5,
        pointerWidth: 5,
        pointerAtEnding: true
      }));
    }

    // =========================
    // 3. DEFINICIÓN DE CARRILES (THE HIGHWAY)
    // =========================
    // Definimos alturas Y específicas para que los cables no se crucen entre sí.
    // Zona "Middle Gap" (entre yRow1 y yRow2) es de ~140px.
    // yRow1 termina en ~245. yRow2 empieza en ~385.
    
    const H_TOP_BUS = yRow1 - 30; // Por encima de todo (Instrucciones)
    
    const GAP_START = yRow1 + MOD_H + 10;
    
    // Carriles en el hueco central (de arriba a abajo)
    const H_RS1     = GAP_START + 10;
    const H_RS2     = GAP_START + 30;
    const H_IMM     = GAP_START + 50;
    const H_ALU_RES = GAP_START + 70;
    const H_MEM_RD  = GAP_START + 90;
    
    const H_BOTTOM  = yRow2 + MOD_H + 20; // Por debajo de todo (Feedback loops)

    // =========================
    // 4. CONEXIONES DE DATOS
    // =========================

    // --- 1. Instrucción (Arriba) ---
    // MemProg -> UControl (Cruza de arriba a abajo, cuidado)
    // MemProg -> GenImm, Banco, etc.
    // Usaremos un carril SUPERIOR para esto.
    
    // MemProg(0) -> GenImm(0)
    wire(memProg, 0, genImm, 0, H_TOP_BUS, S_DATA, 15);
    // MemProg(0) -> Banco(rs1, rs2, rd) - OJO: Banco tiene inputs pegados
    // Hacemos taps manuales para limpieza
    wire(memProg, 0, banco, 0, H_TOP_BUS, S_DATA, 15); // rs1
    wire(memProg, 0, banco, 1, H_TOP_BUS, S_DATA, 15); // rs2
    wire(memProg, 0, banco, 2, H_TOP_BUS, S_DATA, 15); // rd
    // MemProg(0) -> UControl (Bajada larga)
    // Truco: Salimos a la derecha de MemProg, bajamos por la izquierda de la pantalla
    // Pero para simplificar, usaremos un carril vertical dedicado
    {
       const p1 = memProg.getOutputConnectorPosition(0);
       const p2 = uControl.getInputConnectorPosition(0);
       const xPath = boxMemProg.r + 10; // Bajamos justo al lado de memProg
       wiresGroup.add(new Konva.Line({
         points: [p1.x, p1.y, xPath, p1.y, xPath, p2.y, p2.x, p2.y],
         ...S_DATA, stroke: '#60a5fa' // Color distinto para Instrucción
       }));
    }

    // --- 2. Registros (RS1, RS2) ---
    // Banco(0) -> ALU(0)
    wire(banco, 0, alu, 0, H_RS1, S_DATA, 20);
    
    // Banco(1) -> MuxALUSrc(0) y MemDatos(1)[writeData]
    wire(banco, 1, muxALUSrc, 0, H_RS2, S_DATA, 30);
    wire(banco, 1, memDatos,  1, H_RS2, S_DATA, 30); // El cable sigue largo hasta MemDatos

    // --- 3. Inmediatos ---
    // GenImm(0) -> MuxALUSrc(1)
    wire(genImm, 0, muxALUSrc, 1, H_IMM, S_DATA, 20);
    // GenImm(0) -> PCInc(1) (Cruce de fila 1 a fila 2)
    // Bajamos por el carril H_IMM y luego conectamos
    wire(genImm, 0, pcInc, 1, H_IMM, S_DATA, 20);

    // --- 4. ALU Operandos ---
    // MuxALUSrc(0) -> ALU(1) (Están al lado, conexión directa)
    wireDirect(muxALUSrc, 0, alu, 1, S_DATA);

    // --- 5. Resultados ALU ---
    // ALU(0) -> MemDatos(0)[address]
    wireDirect(alu, 0, memDatos, 0, S_DATA);
    
    // ALU(0) -> MuxALU2REG(0) (Bajada de Fila 1 a Fila 2)
    // ALU(0) -> BranchLogic(0) (Bajada a Fila 2)
    wire(alu, 0, muxALU2REG, 0, H_ALU_RES, S_DATA, 25);
    wire(alu, 1, branchLogic, 0, H_ALU_RES, { ...S_DATA, dash: [2,2] }, 40); // Flag Zero

    // --- 6. Memoria Lectura ---
    // MemDatos(0) -> MuxALU2REG(1) (Bajada cruzada)
    wire(memDatos, 0, muxALU2REG, 1, H_MEM_RD, S_DATA, 20);

    // --- 7. Write Back (El loop grande) ---
    // MuxALU2REG(0) -> Banco(3)[writeData]
    // Este debe ir por ABAJO para no cruzar todo el diagrama
    {
       const p1 = muxALU2REG.getOutputConnectorPosition(0);
       const p2 = banco.getInputConnectorPosition(3);
       const yLow = H_BOTTOM;
       
       wiresGroup.add(new Konva.Line({
         points: [
            p1.x, p1.y,
            boxMuxWB.r + 20, p1.y,    // Salir derecha
            boxMuxWB.r + 20, yLow,    // Bajar al fondo
            boxBanco.l - 40, yLow,    // Viajar a la izquierda hasta antes del banco
            boxBanco.l - 40, p2.y,    // Subir
            p2.x, p2.y                // Entrar
         ],
         ...S_DATA, stroke: '#34d399' // Verde para el WriteBack
       }));
    }

    // --- 8. PC Loop ---
    // PC -> MemProg
    // PC -> PCInc
    {
        const pOut = pcMod.getOutputConnectorPosition(0);
        const pInMem = memProg.getInputConnectorPosition(0);
        const pInInc = pcInc.getInputConnectorPosition(0);
        
        // Cable común saliendo de PC hacia la izquierda y subiendo
        const xLoop = boxPC.l - 30;
        
        // Rama 1: a MemProg
        wiresGroup.add(new Konva.Line({
            points: [pOut.x, pOut.y, xLoop, pOut.y, xLoop, pInMem.y, pInMem.x, pInMem.y],
            ...S_DATA
        }));
        
        // Rama 2: a PCInc (directo al lado)
        wireDirect(pcMod, 0, pcInc, 0, S_DATA);
    }
    
    // PCInc -> PC (Next PC) - Loop por abajo
    {
        const p1 = pcInc.getOutputConnectorPosition(0);
        const p2 = pcMod.getInputConnectorPosition(0); // Supongamos input 0 es dinNext
        const yLow = boxPC.b + 15;
        
        wiresGroup.add(new Konva.Line({
            points: [p1.x, p1.y, p1.x, yLow, p2.x, yLow, p2.x, p2.y],
            ...S_DATA
        }));
    }

    // =========================
    // 5. CONTROL SIGNALS (Naranja, Punteado)
    // =========================
    // UC -> Varios. Para limpiar, usaremos conexiones directas "fantasma" o curvas
    // pero manteniendo el estilo ortogonal limpio.
    
    // UCtrl -> MuxALUSrc
    wire(uControl, 0, muxALUSrc, 2, H_RS2 - 5, S_CTRL, 10);
    
    // UCtrl -> ALU Op
    wire(uControl, 1, alu, 2, H_IMM - 5, S_CTRL, 10);
    
    // UCtrl -> MuxALU2REG (WB Sel)
    wireDirect(uControl, 2, muxALU2REG, 2, S_CTRL);
    
    // UCtrl -> MemDatos (WE)
    // Viaje largo a la derecha
    wire(uControl, 3, memDatos, 2, H_MEM_RD + 10, S_CTRL, 10);
    
    // UCtrl -> Banco (WE) - Viaje a la izquierda y arriba
    {
        const p1 = uControl.getOutputConnectorPosition(3); // Asumiendo mismo pin o similar
        const p2 = banco.getInputConnectorPosition(4); // Pin WE
        const xMid = (boxUCtrl.l + boxUCtrl.r)/2;
        wiresGroup.add(new Konva.Line({
             points: [p1.x, p1.y, xMid, p1.y+20, boxBanco.r+10, p1.y+20, boxBanco.r+10, p2.y, p2.x, p2.y],
             ...S_CTRL
        }));
    }
    
    // Branch Logic Connections
    wireDirect(uControl, 5, branchLogic, 1, S_CTRL); // Branch
    wireDirect(branchLogic, 0, pcInc, 2, S_CTRL);    // PCSrc

    // =========================
    // HIGHLIGHT LOGIC
    // =========================
    const modulesByKey = {
      PC: pcMod, PCINC: pcInc, MEM_PROG: memProg, UCTRL: uControl,
      GEN_IMM: genImm, REGFILE: banco, MUX_ALU_SRC: muxALUSrc,
      ALU: alu, MEM_DATA: memDatos, MUX_ALU2REG: muxALU2REG,
      BRANCH_LOGIC: branchLogic,
    };

    const instructionPaths = {
      R: ['PC', 'PCINC', 'MEM_PROG', 'UCTRL', 'REGFILE', 'MUX_ALU_SRC', 'ALU', 'MUX_ALU2REG'],
      LOAD: ['PC', 'PCINC', 'MEM_PROG', 'UCTRL', 'GEN_IMM', 'REGFILE', 'MUX_ALU_SRC', 'ALU', 'MEM_DATA', 'MUX_ALU2REG'],
      STORE: ['PC', 'PCINC', 'MEM_PROG', 'UCTRL', 'GEN_IMM', 'REGFILE', 'MUX_ALU_SRC', 'ALU', 'MEM_DATA'],
      BRANCH: ['PC', 'PCINC', 'MEM_PROG', 'UCTRL', 'GEN_IMM', 'REGFILE', 'ALU', 'BRANCH_LOGIC'],
    };

    function highlightPath(type) {
      // Atenuar todo
      allModules.forEach(m => {
          m.group.opacity(0.3);
          m.group.listening(false);
      });
      wiresGroup.opacity(0.3);
      
      // Resaltar seleccionados
      const keys = instructionPaths[type] || [];
      keys.forEach(k => {
        const mod = modulesByKey[k];
        if (mod) mod.group.opacity(1);
      });
      
      layer.batchDraw();
    }

    return {
      group: root,
      modules: modulesByKey,
      highlightPath
    };
  }

  global.TopDatapath = { create: createTopDatapath };
})(window);