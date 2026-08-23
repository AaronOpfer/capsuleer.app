import {defineConfig, UserConfig} from "vite";
import {compression} from "vite-plugin-compression2";
import preact from "@preact/preset-vite";

export default defineConfig({
    root: "src",
    base: "s",
    build: {
        cssCodeSplit: false,
        outDir: "../static",
        emptyOutDir: true,
        assetsInlineLimit: 100,
        sourcemap: true,
        assetsDir: "",
    },
    plugins: [compression(), preact()],
} satisfies UserConfig);
