import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const wasmSrc = "node_modules/@mediapipe/tasks-vision/wasm";
const wasmDst = "public/mediapipe/wasm";
const modelDst = "public/models/hand_landmarker.task";
const modelUrl =
	"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

await mkdir(wasmDst, { recursive: true });
await mkdir("public/models", { recursive: true });

for (const name of await readdir(wasmSrc)) {
	const src = join(wasmSrc, name);
	if ((await stat(src)).isFile()) {
		await copyFile(src, join(wasmDst, name));
	}
}

let haveModel = false;
try {
	haveModel = (await stat(modelDst)).size > 0;
} catch {
	haveModel = false;
}

if (!haveModel) {
	const res = await fetch(modelUrl);
	if (!res.ok) {
		throw new Error(`download failed: ${res.status}`);
	}
	await Bun.write(modelDst, res);
}

console.log("assets ready");
