(function (global) {
  /**
   * Entradas: alu_result, mem_readData, alu2reg
   * Salidas: writeData
   */
  function createMuxALU2REGModule(params) {
    const {
      x = 80,
      y = 60,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'alu_result',
      'mem_readData',
      'alu2reg',
    ];

    const defaultOutputLabels = [
      'writeData',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'MuxALU2REG',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.MuxALU2REGModule = {
    create: createMuxALU2REGModule,
  };
})(window);
