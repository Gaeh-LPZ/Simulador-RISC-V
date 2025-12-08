(function (global) {
  /**
   * Entradas: ver, branch, br_neg
   * Salidas: take_branch
   */
  function createBranchLogicModule(params) {
    const {
      x = 80,
      y = 60,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'ver',
      'branch',
      'br_neg',
    ];

    const defaultOutputLabels = [
      'take_branch',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'BranchLogic',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.BranchLogicModule = {
    create: createBranchLogicModule,
  };
})(window);
