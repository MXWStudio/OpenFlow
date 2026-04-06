const sharp = require('sharp');
const fs = require('fs');

async function test() {
  try {
    const pipeline = sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 }
      }
    });
    await pipeline.toFile('test.png');
    console.log('Sharp created image successfully.');
  } catch (err) {
    console.error('Sharp failed:', err);
  }
}

test();
