import fs from 'fs-extra';
import path from 'path';
import os from 'os';

async function runBenchmark() {
  const rootDirSeq = path.join(os.tmpdir(), 'openflow_bench_seq_' + Date.now());
  const rootDirBatch = path.join(os.tmpdir(), 'openflow_bench_batch_' + Date.now());

  const projectsData = Array.from({ length: 100 }).map((_, i) => ({
    projectName: `Project_${i}`,
    sizes: ['1920x1080', '1080x1920', '720x1280']
  }));

  const FIXED_FOLDERS = ['截屏素材', '录屏素材', '奇觅生成', '模糊处理'];

  // Sequential
  const startSeq = Date.now();
  for (const project of projectsData) {
    const projectRoot = path.join(rootDirSeq, project.projectName);
    await fs.ensureDir(projectRoot);

    for (const size of project.sizes) {
      const folderName = size.replace(/\*/g, 'x');
      const sizeDir = path.join(projectRoot, folderName);
      await fs.ensureDir(sizeDir);
      await fs.ensureDir(path.join(sizeDir, '_Assets'));
    }

    for (const name of FIXED_FOLDERS) {
      await fs.ensureDir(path.join(projectRoot, name));
    }
  }
  const endSeq = Date.now();
  console.log(`Sequential: ${endSeq - startSeq}ms`);

  // Batch
  const startBatch = Date.now();
  await Promise.all(
    projectsData.map(async (project) => {
      const projectRoot = path.join(rootDirBatch, project.projectName);
      await fs.ensureDir(projectRoot);

      const dirPromises: Promise<void>[] = [];
      for (const size of project.sizes) {
        const folderName = size.replace(/\*/g, 'x');
        const sizeDir = path.join(projectRoot, folderName);
        dirPromises.push(fs.ensureDir(sizeDir).then(() => fs.ensureDir(path.join(sizeDir, '_Assets'))));
      }

      for (const name of FIXED_FOLDERS) {
        dirPromises.push(fs.ensureDir(path.join(projectRoot, name)));
      }
      await Promise.all(dirPromises);
    })
  );
  const endBatch = Date.now();
  console.log(`Batch: ${endBatch - startBatch}ms`);

  await fs.remove(rootDirSeq);
  await fs.remove(rootDirBatch);
}

runBenchmark();
