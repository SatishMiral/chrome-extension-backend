// scraper.js

// Function To Scrap FlipKart Product
export const scrapAmazonProduct = async (page, flipkartUrl) => {
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['stylesheet', 'font', 'image'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
  
    await page.goto(flipkartUrl, { waitUntil: 'domcontentloaded' });
  
    const extractedText = await page.$eval('._6EBuvT', el => el.innerText.trim());
    const extractedPrice = await page.$eval('.Nx9bqj.CxhGGd', el => el.innerText.trim());
  
    const amazonSearchURL = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
    await page.goto(amazonSearchURL, { waitUntil: 'domcontentloaded' });
  
    const amazonPrice = await page.$eval('.a-offscreen', el => el.innerText.trim()).catch(() => null);
    const amazonRating = await page.$eval('.a-icon-alt', el => el.innerText.slice(0, 3)).catch(() => null);
    const amazonLink = await page.$eval('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal',
      el => el.href.startsWith('http') ? el.href : `https://www.amazon.in${el.getAttribute('href')}`).catch(() => null);
  
    return {
      website: "flipkart",
      flipkartData: {
        text: extractedText,
        price: extractedPrice
      },
      amazonData: {
        price: amazonPrice,
        rating: amazonRating,
        link: amazonLink
      }
    };
};

// Function to Scrap Amazon Product
export const scrapFlipkartProduct = async (page, amazonUrl) => {
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['stylesheet', 'font', 'image'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
  
    await page.goto(amazonUrl, { waitUntil: 'domcontentloaded' });
  
    const extractedText = await page.$eval('#productTitle', el => el.innerText.trim());
    console.log("the extracted text from amazon is: ", extractedText);
    const extractedPrice = await page.$eval('.a-price-whole', el => el.innerText.trim());
    console.log("the extracted price from amazon is: ", extractedPrice);
  
    const flipkartSearchURL = `https://www.flipkart.com/search?q=${encodeURIComponent(extractedText)}`;
    console.log("the flipkart link we have gone to: ", flipkartSearchURL);
    await page.goto(flipkartSearchURL, { waitUntil: 'domcontentloaded' });
  
    const flipkartPrice = await page.$eval('.Nx9bqj', el => el.innerText.trim()).catch(() => null);
    console.log("the scraped flipkart price: ", flipkartPrice);
    const flipkartRating = await page.$eval('.XQDdHH', el => el.innerText).catch(() => null);
    console.log("the scraped flipkart rating: ", flipkartRating);
    const selectors = ['.VJA3rP', '.CGtC98', '.rPDeLR'];
    let flipkartLink = null;

    for (const selector of selectors) {
      flipkartLink = await page.$eval(selector, el => {
        const href = el.getAttribute('href');
        return href.startsWith('http') ? href : `https://www.flipkart.com${href}`;
      }).catch(() => null);

      if (flipkartLink) break; // Exit loop if found
    }

  
    return {
      website: "amazon",
      amazonData: {
        text: extractedText,
        price: extractedPrice
      },
      flipkartData: {
        price: flipkartPrice,
        rating: flipkartRating,
        link: flipkartLink
      }
    };
};
  