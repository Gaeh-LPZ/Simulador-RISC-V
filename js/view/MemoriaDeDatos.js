(function (global) {
  function createMemoriaDeDatosModule(params) {
    const {
      x = 350,
      y = 60,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'address',
      'writeData',
      'we',
    ];

    const defaultOutputLabels = [
      'readData',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'MemoriaDeDatos',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.MemoriaDeDatosModule = {
    create: createMemoriaDeDatosModule,
  };
})(window);
