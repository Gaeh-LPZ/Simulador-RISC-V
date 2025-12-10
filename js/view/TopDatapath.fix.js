// js/view/TopDatapath.fix.js
// Wrapper/Enhancer para TopDatapath: expone top.modules (wrappers) y top.wireMap (metadatos)
// Requiere que TopDatapath.create(...) devuelva { group: root } o similar.

(function (global) {
    if (!global.TopDatapath || typeof global.TopDatapath.create !== 'function') return;

    const _origCreate = global.TopDatapath.create;

    function wrapModuleGroup(grp) {
        // detectamos nodos útiles dentro del grupo del módulo
        const texts = grp.find('Text') ? grp.find('Text').toArray() : [];
        if (!texts || texts.length === 0) {
            return { group: grp }; // defensivo
        }

        // título = texto con menor Y (arriba)
        const titleNode = texts.reduce((a, b) => (a.y() < b.y() ? a : b));
        const otherTexts = texts.filter(t => t !== titleNode);

        // Circulos de conectores
        const circles = grp.find('Circle') ? grp.find('Circle').toArray() : [];
        // Separar entradas / salidas por x local (ModuleBase coloca entradas en x≈0, salidas en x≈baseWidth)
        const inputTexts = otherTexts.filter(t => t.x() < 80).sort((a, b) => a.y() - b.y());
        const outputTexts = otherTexts.filter(t => t.x() >= 80).sort((a, b) => a.y() - b.y());
        const inputCircles = circles.filter(c => c.x() < 40).sort((a, b) => a.y() - b.y());
        const outputCircles = circles.filter(c => c.x() >= 40).sort((a, b) => a.y() - b.y());

        function setInputLabel(i, text) {
            if (inputTexts[i]) inputTexts[i].text(String(text));
            if (grp.getLayer()) grp.getLayer().batchDraw();
        }
        function setOutputLabel(i, text) {
            if (outputTexts[i]) outputTexts[i].text(String(text));
            if (grp.getLayer()) grp.getLayer().batchDraw();
        }

        function getInputConnectorPosition(i) {
            if (!inputCircles[i]) return null;
            return inputCircles[i].getAbsolutePosition();
        }
        function getOutputConnectorPosition(i) {
            if (!outputCircles[i]) return null;
            return outputCircles[i].getAbsolutePosition();
        }

        // valor central (texto dinamico tipo setModuleText)
        function setValueLabel(txt) {
            // Crear si no existe (texto central con mayor tamaño)
            if (!grp._valueLabel) {
                const label = new Konva.Text({
                    x: 10,
                    y: 30,                 // un poco más arriba para centrado
                    fontSize: 14,          // <-- tamaño más grande (prueba 14 o 16)
                    fontFamily: 'Ubuntu Mono, monospace',
                    fontStyle: 'bold',     // opcional
                    fill: '#3b2c12',
                    listening: false,
                    width: 140,            // ancho para ajuste de líneas
                    align: 'left',
                    lineHeight: 1.2
                });
                grp.add(label);
                grp._valueLabel = label;
            }

            // Asegurarnos que tenga el tamaño preferido (por si ya existe)
            grp._valueLabel.fontSize(14);
            grp._valueLabel.lineHeight(1.2);

            grp._valueLabel.text(Array.isArray(txt) ? txt.join('\n') : String(txt));
            if (grp.getLayer()) grp.getLayer().batchDraw();
        }


        function setActive(on) {
            grp.opacity(on ? 1 : 0.25);
            if (grp.getLayer()) grp.getLayer().batchDraw();
        }

        return {
            group: grp,
            titleNode,
            setInputLabel,
            setOutputLabel,
            setValueLabel,
            getInputConnectorPosition,
            getOutputConnectorPosition,
            setActive
        };
    }

    function normalizeKey(s) {
        if (!s) return s;
        return s.toString().trim().toUpperCase().replace(/\s+/g, '_');
    }

    global.TopDatapath.create = function (params) {
        const top = _origCreate(params);
        try {
            if (!top || !top.group) return top;

            const root = top.group;

            // Encontrar el grupo "modules" y el grupo "wires"
            let wiresGroup = null;
            let modulesGroup = null;
            root.getChildren().each((child) => {
                if (child.getClassName && child.getClassName() === 'Group') {
                    // heurística: wiresGroup contiene muchas Line, modulesGroup contiene grupos hijos (módulos)
                    const hasLine = child.findOne(node => node.getClassName && node.getClassName() === 'Line');
                    const hasGroupChild = child.getChildren().some(n => n.getClassName && n.getClassName() === 'Group');
                    if (hasLine && !hasGroupChild) {
                        wiresGroup = child;
                    } else if (hasGroupChild || (!modulesGroup && !hasLine)) {
                        modulesGroup = child;
                    }
                }
            });

            const modules = {};
            if (modulesGroup) {
                const modGroups = modulesGroup.getChildren().toArray().filter(n => n.getClassName && n.getClassName() === 'Group');
                modGroups.forEach((grp) => {
                    // extraer titulo (si existe)
                    const titleNode = grp.findOne('Text');
                    const title = titleNode ? titleNode.text().trim() : null;
                    const key = title ? normalizeKey(title) : null;
                    const wrapped = wrapModuleGroup(grp);
                    if (key) modules[key] = wrapped;
                    if (title) modules[title] = wrapped;
                });
            }

            // Rellenar aliases conocidos (para asegurar claves que app.js espera)
            const aliases = {
                PC: ['PROGRAMCOUNTER', 'PROGRAM_COUNTER', 'PC', 'PROGRAMCOUNTERMODULE', 'PROGRAM COUNTER'],
                MEM_PROG: ['MEMORIAPROGRAMA', 'MEM_PROG', 'MEMORIA_DE_PROGRAMA', 'MEMORIAPROGRAMA_MODULE', 'MEMORIA DE PROGRAMA'],
                UCTRL: ['UNIDADDECONTROL', 'UNIDAD_DE_CONTROL', 'UCTRL', 'UNIDADDECONTROLMODULE'],
                REGFILE: ['BANCODEREGISTROS', 'BANCO_DE_REGISTROS', 'BANCO', 'REGFILE', 'BANCODEREGISTROSMODULE'],
                MEM_DATA: ['MEMORIADATOS', 'MEM_DATA', 'MEMORIA_DE_DATOS', 'MEMORIADATOSMODULE'],
                ALU: ['ALU'],
                MUX_ALUSRC: ['MUXALUSRC', 'MUX_ALUSRC'],
                MUX_ALU2REG: ['MUXALU2REG', 'MUX_ALU2REG', 'MUXWB'],
                GEN_IMM: ['GENERADORINMEDIATOS', 'GENIMM'],
                PC_INC: ['PCINCREMENTBRANCH', 'PCINC', 'PC_INC'],
                BRANCH: ['BRANCHLOGIC', 'BRANCH_LOGIC', 'BRANCH']
            };

            Object.keys(aliases).forEach((target) => {
                if (modules[target]) return;
                for (const cand of aliases[target]) {
                    if (modules[cand]) {
                        modules[target] = modules[cand];
                        break;
                    }
                }
            });

            // Detectar y mapear wires (Line) y emparejarlos con módulos por extremos
            const wireLines = [];
            if (wiresGroup) {
                wiresGroup.getChildren().each((n) => {
                    if (n.getClassName && n.getClassName() === 'Line') {
                        wireLines.push(n);
                    }
                });
            } else {
                // fallback: buscar Lines en root
                root.find('Line').each((n) => wireLines.push(n));
            }

            // Construir map: para cada wire, buscar modulo origen/destino comparando puntos extremos con
            // posiciones de conectores de módulos
            const moduleConnectorPositions = []; // [{name, type: 'in'|'out', pos:{x,y}}...]
            Object.keys(modules).forEach((k) => {
                const mod = modules[k];
                if (!mod || !mod.group) return;
                // intentamos 8 conectores max por si acaso
                for (let i = 0; i < 8; i++) {
                    const ip = mod.getInputConnectorPosition ? mod.getInputConnectorPosition(i) : null;
                    const op = mod.getOutputConnectorPosition ? mod.getOutputConnectorPosition(i) : null;
                    if (ip) moduleConnectorPositions.push({ name: k, type: 'in', index: i, pos: ip });
                    if (op) moduleConnectorPositions.push({ name: k, type: 'out', index: i, pos: op });
                }
            });

            function approxEqual(a, b, eps = 6) {
                return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
            }

            const wireMap = [];
            wireLines.forEach((line) => {
                const pts = line.points() || [];
                if (!pts || pts.length < 4) {
                    wireMap.push({ line, from: null, to: null });
                    return;
                }
                const start = { x: pts[0], y: pts[1] };
                const end = { x: pts[pts.length - 2], y: pts[pts.length - 1] };

                let from = null, to = null;
                for (const c of moduleConnectorPositions) {
                    if (!from && approxEqual(start, c.pos)) from = c;
                    if (!to && approxEqual(end, c.pos)) to = c;
                    if (from && to) break;
                }

                wireMap.push({
                    line,
                    points: pts,
                    from: from ? { name: from.name, type: from.type, index: from.index } : null,
                    to: to ? { name: to.name, type: to.type, index: to.index } : null
                });
            });

            // Exponer en top
            top.modules = Object.assign({}, top.modules || {}, modules);
            top.wireMap = wireMap;

            return top;
        } catch (err) {
            // defensivo: si falla devolvemos el top original
            return top;
        }
    };
})(window);
