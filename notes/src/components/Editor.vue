<template>
  <div>
    <quill-editor ref="editor" :options="editorOption"></quill-editor>
  </div>
</template>

<script>
import "quill/dist/quill.core.css";
import "quill/dist/quill.snow.css";
// import "quill/dist/quill.bubble.css";

import { quillEditor, Quill } from "vue-quill-editor";
import QuillCursors from "quill-cursors";

Quill.register("modules/cursors", QuillCursors);
Quill.import("modules/cursors");

export default {
  components: {
    quillEditor
  },
  data() {
    return {
      editorOption: {
        theme: "snow",
        modules: {
          syntax: {
            highlight: text => window.hljs.highlightAuto(text).value
          },
          cursors: true
        }
      }
    };
  }
};
</script>