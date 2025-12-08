(function (global) {
  /**
   * Entradas: rd2, imm, alu_src
   * Salidas: opB
   */
  function createMuxALUSrcModule(params) {
    const {
      x = 80,
      y = 60,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'rd2',
      'imm',
      'alu_src',
    ];

    const defaultOutputLabels = [
      'opB',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'MuxALUSrc',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.MuxALUSrcModule = {
    create: createMuxALUSrcModule,
  };
})(window);
