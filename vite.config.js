import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function standaloneHtml() {
  return {
    name: "standalone-html",
    enforce: "post",
    generateBundle(_options, bundle) {
      const htmlEntry = Object.values(bundle).find(
        (item) => item.type === "asset" && item.fileName.endsWith(".html"),
      );
      const scriptEntry = Object.values(bundle).find(
        (item) => item.type === "chunk" && item.isEntry,
      );
      const styleEntry = Object.values(bundle).find(
        (item) => item.type === "asset" && item.fileName.endsWith(".css"),
      );

      if (!htmlEntry || !scriptEntry) {
        throw new Error("无法生成离线版：缺少 HTML 或 JavaScript 入口。");
      }

      let html = String(htmlEntry.source);
      const escapedScriptName = scriptEntry.fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(
        new RegExp(`<script[^>]+src="[./]*${escapedScriptName}"[^>]*></script>`),
        () => `<script type="module">${scriptEntry.code}</script>`,
      );

      if (styleEntry) {
        const escapedStyleName = styleEntry.fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(
          new RegExp(`<link[^>]+href="[./]*${escapedStyleName}"[^>]*>`),
          () => `<style>${String(styleEntry.source)}</style>`,
        );
        delete bundle[styleEntry.fileName];
      }

      htmlEntry.fileName = "index.html";
      htmlEntry.source = html;
      delete bundle[scriptEntry.fileName];
    },
    closeBundle() {
      copyFileSync(resolve("dist/index.html"), resolve("index.html"));
    },
  };
}

export default defineConfig({
  base: "./",
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    emptyOutDir: true,
    rollupOptions: {
      input: resolve("source.html"),
    },
  },
  plugins: [standaloneHtml()],
});
