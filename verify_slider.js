import puppeteer from 'puppeteer';
import { join } from 'path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('Starting Puppeteer verification for the overlapping slider...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Try standard Vite ports: custom (3000), dev (5173), preview (4173, 4174)
  const ports = [3000, 5173, 4173, 4174];
  let navigated = false;
  for (const port of ports) {
    try {
      console.log(`Navigating to http://localhost:${port}...`);
      await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle2', timeout: 5000 });
      const title = await page.title();
      if (title.includes('Melhores do Ano')) {
        navigated = true;
        console.log(`Successfully connected to Melhores do Ano on port ${port}`);
        break;
      } else {
        console.log(`Port ${port} is serving a different page: "${title}"`);
      }
    } catch (err) {
      console.log(`Port ${port} failed or timed out.`);
    }
  }

  if (!navigated) {
    console.error('Could not connect to the Melhores do Ano local server on any port.');
    await browser.close();
    process.exit(1);
  }

  // Wait for initial page animations
  await sleep(1500);

  const title = await page.title();
  const bodyExists = await page.evaluate(() => !!document.body);
  const sections = await page.evaluate(() => Array.from(document.querySelectorAll('section')).map(s => s.id));
  console.log(`Confirmed Page Title: "${title}"`);
  console.log(`Body exists: ${bodyExists}`);
  console.log(`Available section IDs:`, sections);

  const sectionSelector = '#methodologySection';
  const section = await page.$(sectionSelector);
  if (!section) {
    console.error('Methodology section not found!');
    await browser.close();
    process.exit(1);
  }

  const box = await section.boundingBox();
  console.log('Methodology section bounding box:', box);

  const artifactsDir = 'C:\\Users\\biel3\\.gemini\\antigravity-ide\\brain\\3e26b777-5002-4a18-872c-84c9e22f061b';

  // Helper to scroll and screenshot
  const captureOffset = async (label, offset, filename) => {
    console.log(`Scrolling to ${label} (offset +${offset})...`);
    await page.evaluate((top, off) => {
      window.scrollTo({ top: top + off, behavior: 'instant' });
    }, box.y, offset);
    await sleep(1000);
    const path = join(artifactsDir, filename);
    await page.screenshot({ path });
    console.log(`Saved ${filename} to ${path}`);
  };

  // Capture step 1
  await captureOffset('Step 1: Publicação Oficial', 0, 'methodology_step1.png');

  // Capture step 2
  await captureOffset('Step 2: Votação nos Comentários', 1000, 'methodology_step2.png');

  // Capture step 3
  await captureOffset('Step 3: Auditoria & Apuração', 2200, 'methodology_step3.png');

  // Capture slide 1
  await captureOffset('Kit Slide 1: Apresentação', 4700, 'overlap_slide1_intro.png');

  // Capture slide 2
  await captureOffset('Kit Slide 2: Placa Acrílica', 6200, 'overlap_slide2_plaque.png');

  // Capture slide 3
  await captureOffset('Kit Slide 3: Selo Digital', 7700, 'overlap_slide3_seal.png');

  // Capture slide 4
  await captureOffset('Kit Slide 4: Kit Social + CTA', 9000, 'overlap_slide4_social.png');

  await browser.close();
  console.log('Verification run successfully.');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
