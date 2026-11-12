const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = path.resolve(__dirname, '../public/screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const targets = [
  { file: 'verdiqy-hero-preview.png', url: 'http://localhost:3000/' },
  { file: 'verdiqy-dashboard-preview.png', url: 'http://localhost:3000/problems' },
  { file: 'verdiqy-custom-contest-preview.png', url: 'http://localhost:3000/simulator' },
  { file: 'verdiqy-contests-preview.png', url: 'http://localhost:3000/contests' },
  { file: 'verdiqy-cheat-library-preview.png', url: 'http://localhost:3000/cheatsheets' },
  { file: 'verdiqy-video-solutions-preview.png', url: 'http://localhost:3000/videos' },
  { file: 'verdiqy-compare-preview.png', url: 'http://localhost:3000/compare' },
  { file: 'verdiqy-intelligence-preview.png', url: 'http://localhost:3000/search' },
  { file: 'verdiqy-profile-preview.png', url: 'http://localhost:3000/u/tourist' },
];

async function capture() {
  for (const { file, url } of targets) {
    const rawPath = path.join(OUT_DIR, `raw-${file}`);
    const finalPath = path.join(OUT_DIR, file);

    console.log(`Capturing ${file} from ${url}...`);
    try {
      execSync(
        `"${CHROME_PATH}" --headless --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=3000 --screenshot="${rawPath}" "${url}"`,
        { stdio: 'ignore' }
      );

      if (fs.existsSync(rawPath)) {
        await sharp(rawPath)
          .resize({ width: 1200, withoutEnlargement: true })
          .png({ quality: 80, compressionLevel: 8 })
          .toFile(finalPath);

        fs.unlinkSync(rawPath);
        console.log(`✓ Generated ${file} (${(fs.statSync(finalPath).size / 1024).toFixed(1)} KB)`);
      } else {
        console.error(`✗ Failed to capture ${file}`);
      }
    } catch (err) {
      console.error(`✗ Error capturing ${file}:`, err.message);
    }
  }
}

capture();
