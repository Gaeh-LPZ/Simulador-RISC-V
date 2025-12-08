(function (global) {
  function createUnidadDeControlModule(params) {
    const {
      x = 80,
      y = 40,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'instruction',
    ];

    const defaultOutputLabels = [
      'alu_src',
      'alu_op',
      'alu2reg',
      'we',
      'imm_rd',
      'branch',
      'br_neg',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'UnidadDeControl',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.UnidadDeControlModule = {
    create: createUnidadDeControlModule,
  };
})(window);
