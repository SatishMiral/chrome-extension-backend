// Env Setup
import dotenv from 'dotenv';
dotenv.config();

// Package Installs
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

// Custom Function
import { calculateImageSimilarity } from './matching.js';

// Use Express Framework
const app = express();
app.use(cors());

let browser;

// Function to launch Puppeteer with error handling
const launchBrowser = async () => {
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    console.log("Puppeteer launched successfully.");
  } catch (error) {
    console.error("Failed to launch Puppeteer:", error);
    setTimeout(launchBrowser, 5000);
  }
};

// Initial launch
launchBrowser();

// Restart browser if it crashes
setInterval(async () => {
  if (!browser || !browser.process()) {
    console.error("Puppeteer crashed. Restarting...");
    await launchBrowser();
  }
}, 60000); 

// Intial Path
app.get("/", (req, res) => {
  res.send("Hello World!!!");
});

// Express route to handle amazon scraping
app.get('/compare-flipkart-product', async (req, res) => {
  let page;
  try {
    if (!browser){
      return res.status(500).json({ error: "Puppeteer is not available. Try again later." });
    } 

    const flipkartUrl = req.query.url;
    if (!flipkartUrl){
      return res.status(400).json({ error: "Flipkart URL is required." });
    } 

    console.log("Scraping Flipkart:", flipkartUrl);
    page = await browser.newPage();

    // Optimize resource loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['stylesheet', 'font', 'image'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    // Navigate to Flipkart product page
    await page.goto(flipkartUrl, { waitUntil: 'domcontentloaded' });

    // Extract Flipkart product details 
    await page.waitForSelector('._6EBuvT');
    const extractedText = await page.$eval('._6EBuvT', el => el.innerText.trim());
    console.log("extracted flipkart text", extractedText);

    const extractedPrice = await page.$eval('.Nx9bqj.CxhGGd', el => el.innerText.trim() || null);
    console.log("extracted flipkart price", extractedPrice);

    // Extract image with fallback selector
    // let extractedImage;
    // try {
    //   extractedImage = await page.$eval('.DByuf4.IZexXJ.jLEJ7H', el => el.getAttribute('src'));
    // } catch (err) {
    //   console.log("Primary image selector not found, trying fallback");
    //   extractedImage = await page.$eval('', el => el.getAttribute('src') || null);
    // }
    // console.log("extracted flipkart image", extractedImage);

    // Construct Amazon search URL
    const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
    console.log("Searching Amazon:", amazonUrl);
    await page.goto(amazonUrl, { waitUntil: 'domcontentloaded' });

    // Extract Amazon product details 
    // await page.waitForSelector('.s-image');

    // Extract price 
    const amazonPrice = await page.$eval('.a-offscreen', el => el.innerText.trim()).catch(() => null);
    console.log("Extracted Amazon price:", amazonPrice);

    // Extract rating 
    const amazonRating = await page.$eval('.a-icon-alt', el => el.innerText.slice(0, 3)).catch(() => null);
    console.log("Extracted Amazon rating:", amazonRating);

    // Extract link 
    const amazonLink = await page.$eval('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal', el => 
      el.href.startsWith('http') ? el.href : `https://www.amazon.in${el.getAttribute('href')}`
    ).catch(() => null);
    console.log("Extracted Amazon link:", amazonLink);

    // Extract image 
    // const amazonImage = await page.$eval('.s-image', el => 
    //   el.getAttribute('src')
    // ).catch(() => null);
    // console.log("Extracted Amazon image:", amazonImage);

    // Prepare response data
    const responseData = {
      flipkartData: {
        text: extractedText,
        price: extractedPrice,
        // image: extractedImage
      },
      amazonData: {
        price: amazonPrice,
        rating: amazonRating,
        link: amazonLink,
        // image: amazonImage
      }
    };
    console.log("Response Data:", responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Error running Puppeteer:", error);
    res.status(500).json({ error: "Failed to fetch product details." });
  } finally {
    if (page) await page.close();
  }
});

// Express route to handle flipkart scraping
app.get('/compare-amazon-product', async (req, res) => {
  let page;
  try {
    if (!browser){
      return res.status(500).json({ error: "Puppeteer is not available. Try again later." });
    } 

    const amazonUrl = req.query.url;
    if (!amazonUrl){
      return res.status(400).json({ error: "Amazon URL is required." });
    } 

    console.log("Scraping Amazon:", amazonUrl);
    page = await browser.newPage();

    // Optimize resource loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['stylesheet', 'font', 'image'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    // Navigate to Flipkart product page
    await page.goto(amazonUrl, { waitUntil: 'domcontentloaded' });

    // Extract Amazon product details 
    await page.waitForSelector('#productTitle');
    const extractedText = await page.$eval('#productTitle', el => el.innerText.trim());
    console.log("extracted amazon text", extractedText);

    const extractedPrice = await page.$eval('.a-price-whole', el => el.innerText.trim() || null);
    console.log("extracted amazon price", extractedPrice);

    // Construct Flipkart search URL
    const flipkartUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(extractedText)}`;
    console.log("Searching Flipkart:", flipkartUrl);
    await page.goto(flipkartUrl, { waitUntil: 'domcontentloaded' });

    // Extract price 
    const flipkartPrice = await page.$eval('.Nx9bqj', el => el.innerText.trim()).catch(() => null);
    console.log("Extracted Flipkart price:", flipkartPrice);

    // Extract rating 
    const flipkartRating = await page.$eval('.XQDdHH', el => el.innerText).catch(() => null);
    console.log("Extracted Flipkart rating:", flipkartRating);

    // Extract link 
    const flipkartLink = await page.$eval('.rPDeLR', el => 
      el.href.startsWith('http') ? el.href : `https://www.flipkart.com${el.getAttribute('href')}`
    ).catch(() => null);
    console.log("Extracted Flipkart link:", flipkartLink);

    // Prepare response data
    const responseData = {
      flipkartData: {
        price: flipkartPrice,
        rating: flipkartRating,
        link: flipkartLink
      },
      amazonData: {
        price: extractedPrice,
      }
    };
    console.log("Response Data:", responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Error running Puppeteer:", error);
    res.status(500).json({ error: "Failed to fetch product details." });
  } finally {
    if (page) await page.close();
  }
});

// Start Server On Port 
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});