// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Imports
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

// Custom Methods to Scrape Websites
import { scrapFlipkartProduct, scrapAmazonProduct } from './scraper.js';

const app = express();
app.use(cors());

let browser;

// Launch Puppeteer instance
const launchBrowser = async () => {
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Puppeteer launched.');
  } catch (error) {
    console.error('Puppeteer launch failed:', error);
    setTimeout(launchBrowser, 5000);
  }
};

launchBrowser();

// Health check
app.get('/', (req, res) => {
  res.send('SmartCompare Backend is Running');
});

// Flipkart product URL -> search on Amazon
app.get('/compare-flipkart-product', async (req, res) => {
  const flipkartUrl = req.query.url;
  if (!flipkartUrl) return res.status(400).json({ error: 'Flipkart URL is required.' });
  if (!browser) return res.status(503).json({ error: 'Puppeteer not available.' });

  const page = await browser.newPage();
  try {
    const data = await scrapAmazonProduct(page, flipkartUrl);
    console.log("the flipkart data is", data);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to compare Flipkart product.' });
  } finally {
    await page.close();
  }
});

// Amazon product URL -> search on Flipkart
app.get('/compare-amazon-product', async (req, res) => {
  const amazonUrl = req.query.url;
  if (!amazonUrl) return res.status(400).json({ error: 'Amazon URL is required.' });
  if (!browser) return res.status(503).json({ error: 'Puppeteer not available.' });

  const page = await browser.newPage();
  try {
    const data = await scrapFlipkartProduct(page, amazonUrl);
    console.log("the amazon data is", data);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to compare Amazon product.' });
  } finally {
    await page.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
