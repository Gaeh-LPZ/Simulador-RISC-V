(function (global) {
  /**
   * Entradas: pc, imm, take_branch
   * Salidas: next_pc
   */
  function createPCIncrementBranchModule(params) {
    const {
      x = 80,
      y = 60,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'pc',
      'imm',
      'take_branch',
    ];

    const defaultOutputLabels = [
      'next_pc',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'PC Increment/Branch',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.PCIncrementBranchModule = {
    create: createPCIncrementBranchModule,
  };
})(window);
