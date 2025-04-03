// Env Setup
import dotenv from 'dotenv';
dotenv.config();

// Install Packages
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { calculateImageSimilarity } from './matching.js';
import winston from 'winston';

// Logger Setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' })
  ]
});

// Use Express Framework
const app = express();
app.use(cors());

let browser;

// Function to launch Puppeteer with retry mechanism
const launchBrowser = async (retryCount = 3) => {
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    logger.info("Puppeteer launched successfully.");
  } catch (error) {
    logger.error("Failed to launch Puppeteer:", error);
    if (retryCount > 0) {
      setTimeout(() => launchBrowser(retryCount - 1), 5000);
    } else {
      logger.error("Puppeteer failed after multiple attempts.");
    }
  }
};

// Initial launch
launchBrowser();

// Restart browser if it crashes
setInterval(async () => {
  if (!browser || !browser.process()) {
    logger.error("Puppeteer crashed. Restarting...");
    await launchBrowser();
  }
}, 60000);

// Health Check Route
app.get("/", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

// Express route to handle scraping
app.get('/compare-product', async (req, res) => {
  let page;
  try {
    if (!browser) return res.status(500).json({ success: false, error: "Puppeteer is not available. Try again later." });

    const flipkartUrl = req.query.url;
    if (!flipkartUrl) return res.status(400).json({ success: false, error: "Flipkart URL is required." });

    logger.info(`Scraping Flipkart: ${flipkartUrl}`);
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['stylesheet', 'font', 'image'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(flipkartUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const extractedText = await page.$eval('._6EBuvT', el => el.innerText.trim());
    const extractedPrice = await page.$eval('.Nx9bqj.CxhGGd', el => el.innerText.trim() || null);
    
    logger.info(`Extracted Flipkart Data: ${extractedText}, ${extractedPrice}`);
    
    const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
    logger.info(`Searching Amazon: ${amazonUrl}`);
    await page.goto(amazonUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const results = await page.evaluate(() => {
      const items = [];
      const productElements = document.querySelectorAll('.s-main-slot .s-result-item');

      productElements.forEach(el => {
        const priceElement = el.querySelector('.a-offscreen');
        const ratingElement = el.querySelector('.a-icon-alt');
        const linkElement = el.querySelector('.a-link-normal.s-underline-text');

        if (priceElement && ratingElement && linkElement) {
          items.push({
            price: priceElement.innerText || "No price available",
            rating: ratingElement.innerText.slice(0, 3) || "No rating available",
            link: linkElement.href.startsWith('http') ? linkElement.href : `https://www.amazon.in${linkElement.getAttribute('href')}`
          });
        }
      });
      return items;
    });

    // logger.info(`Extracted Amazon Data: ${JSON.stringify(results)}`);
    res.json({ success: true, results: results.map(result => ({ ...result, extractedPrice })) });
  } catch (error) {
    logger.error("Error running Puppeteer:", error);
    res.status(500).json({ success: false, error: "Failed to fetch product details." });
  } finally {
    if (page) await page.close();
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});