import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const TEMP_DIR = path.join(process.cwd(), 'temp_benchmark');

async function setup(n: number, collisionsPerFile: number) {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    for (let i = 0; i < n; i++) {
        // Original file
        await fs.writeFile(path.join(TEMP_DIR, `file_${i}.txt`), 'content');
        // Files that will cause collisions
        await fs.writeFile(path.join(TEMP_DIR, `new_file_${i}.txt`), 'content');
        for (let j = 1; j < collisionsPerFile; j++) {
            await fs.writeFile(path.join(TEMP_DIR, `new_file_${i}_${j}.txt`), 'content');
        }
    }
}

async function teardown() {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
}

async function fileExists(p: string) {
    try {
        await fs.stat(p);
        return true;
    } catch {
        return false;
    }
}

async function originalLogic(n: number) {
    const files = [];
    for (let i = 0; i < n; i++) {
        files.push({
            filePath: path.join(TEMP_DIR, `file_${i}.txt`),
            newBaseName: `new_file_${i}`,
            ext: '.txt',
            fileName: `file_${i}`
        });
    }

    const start = performance.now();
    for (const file of files) {
        let newFileName = `${file.newBaseName}${file.ext}`;
        let newFilePath = path.join(TEMP_DIR, newFileName);

        let collisionCounter = 1;
        while ((await fileExists(newFilePath)) && newFilePath !== file.filePath) {
            newFileName = `${file.newBaseName}_${collisionCounter}${file.ext}`;
            newFilePath = path.join(TEMP_DIR, newFileName);
            collisionCounter++;
        }

        await fs.rename(file.filePath, newFilePath);
    }
    const end = performance.now();
    return end - start;
}

async function optimizedLogic(n: number) {
    const files = [];
    for (let i = 0; i < n; i++) {
        files.push({
            filePath: path.join(TEMP_DIR, `file_${i}.txt`),
            newBaseName: `new_file_${i}`,
            ext: '.txt',
            fileName: `file_${i}`
        });
    }

    const start = performance.now();
    const dirCache = new Map<string, Set<string>>();

    async function getDirFiles(dir: string) {
        if (!dirCache.has(dir)) {
            try {
                const names = await fs.readdir(dir);
                dirCache.set(dir, new Set(names));
            } catch {
                dirCache.set(dir, new Set());
            }
        }
        return dirCache.get(dir)!;
    }

    for (const file of files) {
        const dir = path.dirname(file.filePath);
        const existingFiles = await getDirFiles(dir);

        let newFileName = `${file.newBaseName}${file.ext}`;

        let collisionCounter = 1;
        while (existingFiles.has(newFileName) && path.join(dir, newFileName) !== file.filePath) {
            newFileName = `${file.newBaseName}_${collisionCounter}${file.ext}`;
            collisionCounter++;
        }

        const newFilePath = path.join(dir, newFileName);
        await fs.rename(file.filePath, newFilePath);

        // Update cache
        existingFiles.delete(path.basename(file.filePath));
        existingFiles.add(newFileName);
    }
    const end = performance.now();
    return end - start;
}

async function run() {
    const N = 200;
    const COLLISIONS = 5;

    console.log(`Running baseline (original logic) with N=${N}, COLLISIONS=${COLLISIONS}...`);
    await setup(N, COLLISIONS);
    const timeOrig = await originalLogic(N);
    console.log(`Original logic took: ${timeOrig.toFixed(2)}ms`);
    await teardown();

    console.log(`Running optimized logic with N=${N}, COLLISIONS=${COLLISIONS}...`);
    await setup(N, COLLISIONS);
    const timeOpt = await optimizedLogic(N);
    console.log(`Optimized logic took: ${timeOpt.toFixed(2)}ms`);
    await teardown();

    const improvement = ((timeOrig - timeOpt) / timeOrig) * 100;
    console.log(`Improvement: ${improvement.toFixed(2)}%`);
}

run();
