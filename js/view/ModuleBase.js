(function (global) {
    const DEFAULT_COLORS = {
        bodyFill: '#ffd84a',      // amarillo
        border: '#6b0000',        // rojo oscuro
        titleText: '#004a9f',     // azul para el título
        labelText: '#000000',     // negro
        connector: '#6b0000',     // mismo rojo para puntos
    };

    /**
     * Crea un bloque genérico de módulo Konva.
     *
     * options:
     *  - x, y: posición inicial
     *  - name: nombre del módulo (título)
     *  - inputLabels: array de strings para las entradas (lado izquierdo)
     *  - outputLabels: array de strings para las salidas (lado derecho)
     *  - scale: factor de escala (1 = tamaño base)
     *  - colors: objeto parcial para sobrescribir DEFAULT_COLORS
     */
    function createModuleBlock(options) {
        const {
            x = 0,
            y = 0,
            name = 'Modulo',
            inputLabels = [],
            outputLabels = [],
            scale = 1,
            colors = {},
        } = options || {};

        const c = { ...DEFAULT_COLORS, ...colors };

        const baseWidth = 160;
        const baseHeight = 260;
        const cornerRadius = 6;
        const padding = 8;
        const titleHeight = 24;
        const connectorRadius = 4;
        const leftColumnWidth = baseWidth / 2 - 2 * padding;
        const rightColumnWidth = baseWidth / 2 - 2 * padding;

        const CONNECTOR_TOP_OFFSET = 50;
        const group = new Konva.Group({
            x,
            y,
            listening: true,
        });

        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: baseWidth,
            height: baseHeight,
            cornerRadius: cornerRadius,
            fill: c.bodyFill,
            stroke: c.border,
            strokeWidth: 4,
        });
        group.add(rect);

        const title = new Konva.Text({
            x: 0,
            y: padding,
            width: baseWidth,
            align: 'center',
            text: name,
            fontSize: 15,
            fontStyle: 'bold',
            fill: c.titleText,
        });

        group.add(title);

        // Zona interna para labels
        const contentTop = padding + titleHeight + CONNECTOR_TOP_OFFSET;
        const contentBottom = baseHeight - padding;
        const availableHeight = contentBottom - contentTop;

        // Función para distribuir verticalmente N elementos
        function getYPositions(count) {
            if (count <= 0) return [];
            const gap = availableHeight / (count + 1);
            const positions = [];
            for (let i = 0; i < count; i++) {
                positions.push(contentTop + gap * (i + 1));
            }
            return positions;
        }

        const inputYs = getYPositions(inputLabels.length);
        const outputYs = getYPositions(outputLabels.length);

        const inputConnectorMap = {};
        const outputConnectorMap = {};

        const labelOffsetX = 8; // distancia del borde interno

        // Entradas (lado izquierdo)
        inputLabels.forEach((text, idx) => {
            const yPos = inputYs[idx];

            const circle = new Konva.Circle({
                x: 0,
                y: yPos,
                radius: connectorRadius,
                fill: c.connector,
                stroke: 'black',
                strokeWidth: 1,
            });

            const label = new Konva.Text({
                x: padding + labelOffsetX,
                y: yPos - 8,
                width: leftColumnWidth,
                align: 'left',
                text: text,
                fontSize: 16,
                fill: c.labelText,
            });

            group.add(circle);
            group.add(label);

            inputConnectorMap[idx] = {
                id: idx,
                labelText: text,
                circle,
                label,
            };
        });


        // Salidas (lado derecho)
        outputLabels.forEach((text, idx) => {
            const yPos = outputYs[idx];

            const circle = new Konva.Circle({
                x: baseWidth,
                y: yPos,
                radius: connectorRadius,
                fill: c.connector,
                stroke: 'black',
                strokeWidth: 1,
            });

            const label = new Konva.Text({
                x: baseWidth / 2,          // arranca a la mitad del módulo
                y: yPos - 8,
                width: rightColumnWidth,   // ocupa solo la mitad derecha
                align: 'right',
                text: text,
                fontSize: 16,
                fill: c.labelText,
            });

            group.add(circle);
            group.add(label);

            outputConnectorMap[idx] = {
                id: idx,
                labelText: text,
                circle,
                label,
            };
        });


        // Aplicar escala global manteniendo la figura
        group.scale({ x: scale, y: scale });

        // API para posiciones absolutas de los conectores
        function getInputConnectorPosition(index) {
            const obj = inputConnectorMap[index];
            if (!obj) return null;
            const pos = obj.circle.getAbsolutePosition();
            return { x: pos.x, y: pos.y };
        }

        function getOutputConnectorPosition(index) {
            const obj = outputConnectorMap[index];
            if (!obj) return null;
            const pos = obj.circle.getAbsolutePosition();
            return { x: pos.x, y: pos.y };
        }

        function getAllConnectorPositions() {
            const inputs = {};
            Object.keys(inputConnectorMap).forEach((k) => {
                inputs[k] = getInputConnectorPosition(k);
            });

            const outputs = {};
            Object.keys(outputConnectorMap).forEach((k) => {
                outputs[k] = getOutputConnectorPosition(k);
            });

            return { inputs, outputs };
        }

        // API para actualizar textos de labels (p.ej. valores dinámicos)
        function setInputLabel(index, newText) {
            const obj = inputConnectorMap[index];
            if (!obj) return;
            obj.label.text(newText);
        }

        function setOutputLabel(index, newText) {
            const obj = outputConnectorMap[index];
            if (!obj) return;
            obj.label.text(newText);
        }

        return {
            group,
            inputConnectors: inputConnectorMap,
            outputConnectors: outputConnectorMap,
            getInputConnectorPosition,
            getOutputConnectorPosition,
            getAllConnectorPositions,
            setInputLabel,
            setOutputLabel,
        };
    }

    global.ModuleBase = {
        createModuleBlock,
    };
})(window);
