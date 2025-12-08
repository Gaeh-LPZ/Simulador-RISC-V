(function (global) {
  function createMemoriaDeProgramaModule(params) {
    const {
      x = 700,
      y = 40,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'pc',
    ];

    const defaultOutputLabels = [
      'instruction',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'MemoriaDePrograma',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.MemoriaDeProgramaModule = {
    create: createMemoriaDeProgramaModule,
  };
})(window);
