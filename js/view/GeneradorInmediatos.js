(function (global) {
  /**
   * Módulo "GeneradorInmediatos"
   *
   * Entradas:
   *  - instruction (32 bits)
   *  - immType (I, S, B, U, J)
   *
   * Salidas:
   *  - immediate (32 bits, sign-extended)
   *
   * params:
   *  - x, y: posición en el escenario
   *  - scale: factor de escala (1 = tamaño base)
   *  - colors: (opcional) para sobrescribir colores por defecto
   *  - inputTexts: array opcional para los labels de entrada
   *  - outputTexts: array opcional para los labels de salida
   */
  function createGeneradorInmediatosModule(params) {
    const {
      x = 80,
      y = 60,
      scale = 1,
      colors = {},
      inputTexts,
      outputTexts,
    } = params || {};

    const defaultInputLabels = [
      'instruction (32 bits)',
      'immType (I/S/B/U/J)',
    ];

    const defaultOutputLabels = [
      'immediate (32 bits)',
    ];

    const block = ModuleBase.createModuleBlock({
      x,
      y,
      name: 'GeneradorInmediatos',
      inputLabels: inputTexts || defaultInputLabels,
      outputLabels: outputTexts || defaultOutputLabels,
      scale,
      colors,
    });

    return block;
  }

  global.GeneradorInmediatosModule = {
    create: createGeneradorInmediatosModule,
  };
})(window);
