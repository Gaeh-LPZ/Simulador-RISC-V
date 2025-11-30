import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";

let startState = EditorState.create({
    doc : "addi x1, x0, 4",
    extensions : keymap.of(defaultKeymap)
});

let view = new EditorView ({
    state : startState,
    parent : document.getElementById('editor')
});