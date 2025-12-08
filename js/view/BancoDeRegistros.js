(function (global) {
  function createBancoDeRegistrosModule(params) {
    const {
      x = 50,
      y = 50,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'rs1',
      'rs2',
      'rd',
      'writeData',
      'we',
    ];

    const defaultOutputLabels = [
      'rd1',
      'rd2',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'BancoDeRegistros',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.BancoDeRegistrosModule = {
    create: createBancoDeRegistrosModule,
  };
})(window);
