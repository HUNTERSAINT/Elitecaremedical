import { readFile, writeFile } from "node:fs/promises";

const generatedPath = new URL("../api-zod/src/generated/api.ts", import.meta.url);
const source = await readFile(generatedPath, "utf8");
const fixed = source.replaceAll("zod.int()", "zod.number().int()");

if (fixed !== source) {
  await writeFile(generatedPath, fixed);
}