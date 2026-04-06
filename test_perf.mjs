import * as fs from 'fs/promises'
import * as path from 'path'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SIZE_FOLDER_REGEX = /^\d+[xX*\-]\d+$/
const SKIP_DIRS_READ_SIZE = new Set(['_Assets', '素材', '奇觅生成'])

async function generateTestData(rootDir, numDirs) {
  await fs.mkdir(rootDir, { recursive: true })
  for (let i = 0; i < numDirs; i++) {
    const dirName = i % 2 === 0 ? `1920x${1080 + i}` : `test_dir_${i}`
    await fs.mkdir(join(rootDir, dirName))
    for (let j = 0; j < 5; j++) {
      await fs.writeFile(join(rootDir, dirName, `file_${j}.txt`), 'test')
    }
    // Mix in some files
    await fs.writeFile(join(rootDir, `root_file_${i}.txt`), 'test')
  }
}

async function original(roots) {
  const sizeSet = new Set()
  for (const dir of roots) {
    let names
    try {
      names = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (SKIP_DIRS_READ_SIZE.has(name)) continue
      const full = join(dir, name)
      let stat
      try {
        stat = await fs.stat(full)
      } catch {
        continue
      }
      if (!stat.isDirectory()) continue
      if (!SIZE_FOLDER_REGEX.test(name)) continue
      sizeSet.add(name.replace(/[xX-]/g, '*'))
    }
  }
  return [...sizeSet]
}

async function optimized(roots) {
  const sizeSet = new Set()
  for (const dir of roots) {
    let names
    try {
      names = await fs.readdir(dir)
    } catch {
      continue
    }

    // Optimized approach: map all async ops and await them at once
    const statPromises = names.map(async (name) => {
      if (SKIP_DIRS_READ_SIZE.has(name)) return
      if (!SIZE_FOLDER_REGEX.test(name)) return // Do regex test first to avoid unnecessary stats if possible

      const full = join(dir, name)
      try {
        const stat = await fs.stat(full)
        if (stat.isDirectory()) {
          sizeSet.add(name.replace(/[xX-]/g, '*'))
        }
      } catch {
        // ignore
      }
    })

    await Promise.all(statPromises)
  }
  return [...sizeSet]
}

async function runBenchmark() {
  const testRoot = path.join(__dirname, 'test_perf_dir')
  await fs.rm(testRoot, { recursive: true, force: true })
  console.log('Generating test data...')
  await generateTestData(testRoot, 1000) // 1000 directories, plus files

  const roots = new Set([testRoot])

  console.log('Running original...')
  const startOriginal = performance.now()
  const res1 = await original(roots)
  const endOriginal = performance.now()

  console.log('Running optimized...')
  const startOptimized = performance.now()
  const res2 = await optimized(roots)
  const endOptimized = performance.now()

  console.log(`Original: ${endOriginal - startOriginal}ms, res length: ${res1.length}`)
  console.log(`Optimized: ${endOptimized - startOptimized}ms, res length: ${res2.length}`)

  // Clean up
  await fs.rm(testRoot, { recursive: true, force: true })
}

runBenchmark().catch(console.error)
