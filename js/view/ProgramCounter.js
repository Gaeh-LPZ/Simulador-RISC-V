(function (global) {
  /**
   * Crea el módulo "ProgramCounter".
   *
   * Entradas:
   *  - pcNext (32 bits)
   *  - reset (bool)
   *
   * Salidas:
   *  - pc (32 bits)
   *
   * params:
   *  - x, y: posición en el escenario
   *  - scale: factor de escala (1 = tamaño base)
   *  - colors: (opcional) para sobrescribir los colores por defecto
   *  - inputTexts: array opcional para los labels de entrada
   *  - outputTexts: array opcional para los labels de salida
   */
  function createProgramCounterModule(params) {
    const {
      x = 60,
      y = 300,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'pcNext (32 bits)',
      'reset (bool)',
    ];

    const defaultOutputLabels = [
      'pc (32 bits)',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'ProgramCounter',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.ProgramCounterModule = {
    create: createProgramCounterModule,
  };
})(window);
