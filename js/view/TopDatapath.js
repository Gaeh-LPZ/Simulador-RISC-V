(function (global) {
  function createTopDatapath(params) {
    const {
      layer,
      width,
      height,
      padding = 10,
    } = params || {};

    if (!layer) {
      throw new Error('TopDatapath.create: necesitas pasar { layer }');
    }

    // Grupo raíz
    const root = new Konva.Group();
    layer.add(root);

    // Grupo para cables (debajo) y grupo para módulos (encima)
    const wiresGroup = new Konva.Group();
    const modulesGroup = new Konva.Group();
    root.add(wiresGroup);
    root.add(modulesGroup);

    // Tamaño lógico de cada módulo (debe coincidir con ModuleBase.js)
    const MODULE_W = 160;
    const MODULE_H = 260;
    const COL_GAP  = 150;
    const ROW_GAP  = 20;

    const COL_STEP = MODULE_W + COL_GAP; // 240
    const ROW_STEP = MODULE_H + ROW_GAP; // 340

    // Rejilla lógica (ancha, luego se escala al contenedor)
    const x0 = 20;
    const x1 = x0 + COL_STEP; // 260
    const x2 = x1 + COL_STEP; // 500
    const x3 = x2 + COL_STEP; // 740
    const x4 = x3 + COL_STEP; // 980
    const x5 = x4 + COL_STEP; // 1220

    const y0 = 20;            // fila superior
    const y1 = y0 + ROW_STEP; // fila media
    const y2 = y1 + ROW_STEP; // fila inferior

    function pos(x, y) {
      return { x, y };
    }

    // === Crear módulos dentro de modulesGroup ===
    function attachModule(block) {
      modulesGroup.add(block.group);
      return block;
    }

    const pcMod       = attachModule(ProgramCounterModule.create      ({ ...pos(x0, y2), scale: 1 }));
    const pcInc       = attachModule(PCIncrementBranchModule.create   ({ ...pos(x1, y2), scale: 1 }));
    const memProg     = attachModule(MemoriaDeProgramaModule.create   ({ ...pos(x0, y0), scale: 1 }));
    const genImm      = attachModule(GeneradorInmediatosModule.create ({ ...pos(x1, y0), scale: 1 }));
    const uControl    = attachModule(UnidadDeControlModule.create     ({ ...pos(x2, y0), scale: 1 }));
    const banco       = attachModule(BancoDeRegistrosModule.create    ({ ...pos(x2, y1), scale: 1 }));
    const muxALUSrc   = attachModule(MuxALUSrcModule.create           ({ ...pos(x3, y1), scale: 1 }));
    const alu         = attachModule(ALUModule.create                 ({ ...pos(x4, y1), scale: 1 }));
    const memDatos    = attachModule(MemoriaDeDatosModule.create      ({ ...pos(x5, y1), scale: 1 }));
    const muxALU2REG  = attachModule(MuxALU2REGModule.create          ({ ...pos(x3, y2), scale: 1 }));
    const branchLogic = attachModule(BranchLogicModule.create         ({ ...pos(x4, y2), scale: 1 }));

    const allModules = [
      pcMod,
      pcInc,
      memProg,
      genImm,
      uControl,
      banco,
      muxALUSrc,
      alu,
      memDatos,
      muxALU2REG,
      branchLogic,
    ];

    allModules.forEach((m) => m.group.opacity(0.25));

    // === Helper para conexiones ORTOGONALES (H-V-H) ===
    function connect(fromModule, fromOutIndex, toModule, toInIndex, options) {
      const p1 = fromModule.getOutputConnectorPosition(fromOutIndex);
      const p2 = toModule.getInputConnectorPosition(toInIndex);
      if (!p1 || !p2) return null;

      // Punto “corredor” en X, entre origen y destino
      let corridorX = (p1.x + p2.x) / 2;

      // Si están muy cerca en X, empuja el corredor un poco hacia la derecha
      if (Math.abs(p1.x - p2.x) < MODULE_W * 0.3) {
        corridorX = p1.x + (p1.x < x3 ? -40 : 40);
      }

      const points = [
        p1.x, p1.y,          // desde el conector de salida
        corridorX, p1.y,     // horizontal
        corridorX, p2.y,     // vertical
        p2.x, p2.y,          // horizontal hacia el conector de entrada
      ];

      const line = new Konva.Line({
        points,
        stroke: (options && options.stroke) || '#dddddd',
        strokeWidth: (options && options.strokeWidth) || 2,
        lineCap: 'round',
        lineJoin: 'round',
        dash: (options && options.dash) || [],
      });

      wiresGroup.add(line);
      return line;
    }

    const DATA_BUS    = { stroke: '#f5f5f5', strokeWidth: 2.5 };
    const CONTROL_BUS = { stroke: '#ff7b7b', strokeWidth: 2, dash: [6, 4] };

    // === Conexiones ===
    // PC y Memoria de programa
    connect(pcMod, 0, memProg, 0, DATA_BUS);
    connect(pcMod, 0, pcInc,   0, DATA_BUS);

    // instruction bus
    connect(memProg, 0, uControl, 0, DATA_BUS);
    connect(memProg, 0, genImm,   0, DATA_BUS);

    // instruction (rs1, rs2, rd) -> Banco
    connect(memProg, 0, banco, 0, DATA_BUS);
    connect(memProg, 0, banco, 1, DATA_BUS);
    connect(memProg, 0, banco, 2, DATA_BUS);

    // Unidad de control
    connect(uControl, 0, muxALUSrc,   2, CONTROL_BUS); // alu_src
    connect(uControl, 1, alu,         2, CONTROL_BUS); // alu_op
    connect(uControl, 2, muxALU2REG,  2, CONTROL_BUS); // alu2reg
    connect(uControl, 3, banco,       4, CONTROL_BUS); // we -> RF
    connect(uControl, 3, memDatos,    2, CONTROL_BUS); // we -> DM
    connect(uControl, 4, genImm,      1, CONTROL_BUS); // imm_rd
    connect(uControl, 5, branchLogic, 1, CONTROL_BUS); // branch
    connect(uControl, 6, branchLogic, 2, CONTROL_BUS); // br_neg

    // Banco de registros
    connect(banco, 0, alu,       0, DATA_BUS); // rd1 -> opA
    connect(banco, 1, muxALUSrc, 0, DATA_BUS); // rd2 -> MuxALUSrc
    connect(banco, 1, memDatos,  1, DATA_BUS); // rd2 -> writeData

    // MuxALU2REG.writeData -> RF.writeData
    connect(muxALU2REG, 0, banco, 3, DATA_BUS);

    // Generador de inmediatos
    connect(genImm, 0, muxALUSrc, 1, DATA_BUS); // imm -> MuxALUSrc.imm
    connect(genImm, 0, pcInc,     1, DATA_BUS); // imm -> PCInc.imm

    // MuxALUSrc.opB -> ALU.opB
    connect(muxALUSrc, 0, alu, 1, DATA_BUS);

    // ALU
    connect(alu, 0, memDatos,   0, DATA_BUS); // result -> address
    connect(alu, 0, muxALU2REG, 0, DATA_BUS); // result -> alu_result
    connect(alu, 1, branchLogic,0, DATA_BUS); // ver -> BranchLogic.ver

    // Memoria de datos
    connect(memDatos, 0, muxALU2REG, 1, DATA_BUS); // readData -> MuxALU2REG.mem_readData

    // BranchLogic y PC
    connect(branchLogic, 0, pcInc, 2, CONTROL_BUS); // take_branch -> PCInc.take_branch
    connect(pcInc, 0, pcMod, 0, DATA_BUS);          // next_pc -> pcNext

    // === Highlight ===
    const modulesByKey = {
      PC: pcMod,
      PCINC: pcInc,
      MEM_PROG: memProg,
      UCTRL: uControl,
      GEN_IMM: genImm,
      REGFILE: banco,
      MUX_ALU_SRC: muxALUSrc,
      ALU: alu,
      MEM_DATA: memDatos,
      MUX_ALU2REG: muxALU2REG,
      BRANCH_LOGIC: branchLogic,
    };

    const instructionPaths = {
      R: [
        'PC',
        'PCINC',
        'MEM_PROG',
        'UCTRL',
        'REGFILE',
        'MUX_ALU_SRC',
        'ALU',
        'MUX_ALU2REG',
      ],
      LOAD: [
        'PC',
        'PCINC',
        'MEM_PROG',
        'UCTRL',
        'GEN_IMM',
        'REGFILE',
        'MUX_ALU_SRC',
        'ALU',
        'MEM_DATA',
        'MUX_ALU2REG',
      ],
      STORE: [
        'PC',
        'PCINC',
        'MEM_PROG',
        'UCTRL',
        'GEN_IMM',
        'REGFILE',
        'MUX_ALU_SRC',
        'ALU',
        'MEM_DATA',
      ],
      BRANCH: [
        'PC',
        'PCINC',
        'MEM_PROG',
        'UCTRL',
        'GEN_IMM',
        'REGFILE',
        'ALU',
        'BRANCH_LOGIC',
      ],
    };

    function highlightPath(type) {
      allModules.forEach((m) => m.group.opacity(0.6));
      const pathKeys = instructionPaths[type] || [];
      pathKeys.forEach((k) => {
        const mod = modulesByKey[k];
        if (mod) mod.group.opacity(1);
      });
      layer.batchDraw();
    }

    // === Ajuste al tamaño del contenedor ===
    function fitToContainer(containerWidth, containerHeight) {
      if (!containerWidth || !containerHeight) return;

      const bbox = root.getClientRect({ skipStroke: false });

      const availW = containerWidth  - 2 * padding;
      const availH = containerHeight - 2 * padding;

      const scale = Math.min(
        availW  / bbox.width,
        availH  / bbox.height
      );

      root.scale({ x: scale, y: scale });

      const offsetX = padding + (availW  - bbox.width  * scale) / 2 - bbox.x * scale;
      const offsetY = padding + (availH  - bbox.height * scale) / 2 - bbox.y * scale;

      root.position({ x: offsetX, y: offsetY });

      layer.batchDraw();
    }

    if (typeof width === 'number' && typeof height === 'number') {
      fitToContainer(width, height);
    }

    return {
      modules: {
        pcMod,
        pcInc,
        memProg,
        uControl,
        genImm,
        banco,
        muxALUSrc,
        alu,
        memDatos,
        muxALU2REG,
        branchLogic,
      },
      highlightPath,
      fitToContainer,
    };
  }

  global.TopDatapath = {
    create: createTopDatapath,
  };
})(window);
