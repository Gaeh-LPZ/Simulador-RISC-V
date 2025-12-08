(function (global) {
  function createALUModule(params) {
    const {
      x = 80,
      y = 60,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'opA',
      'opB',
      'alu_op',
    ];

    const defaultOutputLabels = [
      'result',
      'ver',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'ALU',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.ALUModule = {
    create: createALUModule,
  };
})(window);
