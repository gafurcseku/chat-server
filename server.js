const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");
const Brand = require("./models/Brand");
const Medicine = require("./models/Medicine");

const app = express();

// ============================================
// 📌 CONFIGURATION //28e8eb5199d97ed32ad14feee1dd28b9
// e6c76d1c42b153056ae4c3455a266c2a
// ============================================
const CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://bac:123abc45cba@cluster0.qchgzga.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  SCRAPER_API_KEY: process.env.SCRAPER_API_KEY || "28e8eb5199d97ed32ad14feee1dd28b9",
  PORT: process.env.PORT || 3000,
  SCRAPE_DELAY: 2000, // 2 seconds delay between requests
  MAX_PAGES: 830,
  BASE_URL: "https://medex.com.bd"
};

// ============================================
// 🔗 DATABASE CONNECTION
// ============================================
const connectDB = async () => {
  try {
    await mongoose.connect(CONFIG.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();

// ============================================
// 🛠️ UTILITY FUNCTIONS
// ============================================

/**
 * Fetches HTML content using ScraperAPI
 * @param {string} url - Target URL to scrape
 * @returns {Promise<string>} HTML content
 */
const fetchWithScraperAPI = async (url) => {
  const apiUrl = `https://api.scraperapi.com?api_key=${CONFIG.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
  
  try {
    const { data } = await axios.get(apiUrl, {
      timeout: 60000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error.message);
    throw error;
  }
};

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extracts sections from accordion headers
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Object} Sections object
 */
const extractSections = ($) => {
  const sections = {};
  
  $("h3.ac-header").each((i, el) => {
    const title = $(el).text().trim();
    const content = $(el).parent().next(".ac-body").text().trim();
    if (title && content) {
      sections[title] = content;
    }
  });
  
  return sections;
};

// ============================================
// 🧹 SCRAPING FUNCTIONS
// ============================================

/**
 * Scrapes a single page of brands
 * @param {number} page - Page number to scrape
 * @returns {Promise<Array>} Array of brand objects
 */
async function scrapeMedexPage(page = 1) {
  try {
    console.log(`📄 Scraping page ${page}...`);
    
    const url = `${CONFIG.BASE_URL}/brands?page=${page}`;
    const html = await fetchWithScraperAPI(url);
    const $ = cheerio.load(html);
    
    const brands = [];

    $(".hoverable-block").each((_, element) => {
      const href = $(element).attr("href");
      const fullLink = href || "";
      
      const dosageIcon = $(element).find(".md-icon-container img").attr("src") || "";
      const name = $(element).find(".col-xs-12.data-row-top").text().replace(/\s+/g, " ").trim();
      const strength = $(element).find(".col-xs-12.data-row-strength span").text().trim();
      const generic = $(element).find(".col-xs-12").eq(2).text().trim();
      const company = $(element).find(".data-row-company").text().trim();

      brands.push({ 
        name, 
        strength, 
        generic, 
        company, 
        dosageIcon, 
        link: fullLink,
        isDetails: false 
      });
    });

    console.log(`✅ Found ${brands.length} brands on page ${page}`);
    return brands;
  } catch (error) {
    console.error(`❌ Error scraping page ${page}:`, error.message);
    throw error;
  }
}

/**
 * Scrapes detailed medicine information
 * @param {string} url - Medicine detail page URL
 * @param {string} brandId - MongoDB Brand ID
 * @returns {Promise<Object|null>} Medicine object or null if failed
 */
async function scrapeMedicineDetails(url, brandId) {
  try {
    console.log(`🔍 Scraping medicine details: ${url}`);
    
    const html = await fetchWithScraperAPI(url);
     console.log(html.substring(0, 500));
    const $ = cheerio.load(html);

    // Validate page loaded correctly
    if (!$(".page-heading-1-l.brand").length) {
      console.warn(`⚠️ Invalid page structure for: ${url}`);
      return null;
    }

    // Extract basic information
    const name = $(".page-heading-1-l.brand")
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .trim();
    
    const dosageForm = $(".page-heading-1-l.brand small").text().trim();
    const image = $(".innovator-brand-badge").attr("href") || "";
    const generic = $('div[title="Generic Name"]').text().trim();
    const strength = $('div[title="Strength"]').text().trim();
    const company = $('div[title="Manufactured by"] a').text().trim();

    // Extract pricing information
    const packageContainer = $(".package-container");
    const spans = packageContainer.find("span");
    const priceLabel = spans.eq(0).text().trim();
    const unitPrice = spans.eq(1).text().trim();
    const stripPrice = packageContainer
      .find('span:contains("Strip Price:")')
      .next("span")
      .text()
      .trim();

    // Extract detailed sections
    const sections = extractSections($);

    const medicine = {
      brandId,
      name,
      image,
      generic,
      strength,
      company,
      priceLabel,
      unitPrice,
      stripPrice,
      packInfo: $("div.brand-pricing").text().trim(),
      indications: sections["Indications"] || "",
      composition: sections["Composition"] || "",
      pharmacology: sections["Pharmacology"] || "",
      dosage: sections["Dosage & Administration"] || "",
      interaction: sections["Interaction"] || "",
      contraindications: sections["Contraindications"] || "",
      sideEffects: sections["Side Effects"] || "",
      pregnancy: sections["Pregnancy & Lactation"] || "",
      precautions: sections["Precautions & Warnings"] || "",
      overdose: sections["Overdose Effects"] || "",
      therapeuticClass: sections["Therapeutic Class"] || "",
      storage: sections["Storage Conditions"] || "",
      questions: sections[`Common Questions about ${name}`] || "",
      url,
    };

    console.log(`✅ Successfully scraped: ${medicine}`);
    return medicine;
  } catch (error) {
    console.error(`❌ Error scraping medicine details from ${url}:`, error.message);
    return null;
  }
}

// ============================================
// 📡 API ROUTES
// ============================================

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

/**
 * Scrape all brand pages
 */
app.get("/scrape", async (req, res) => {
  let successCount = 0;
  let errorCount = 0;

  try {
    for (let page = 1; page <= CONFIG.MAX_PAGES; page++) {
      try {
        const pageData = await scrapeMedexPage(page);

        for (const brand of pageData) {
          try {
            await Brand.findOneAndUpdate(
              { link: brand.link },
              brand,
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            successCount++;
            console.log(`✅ Saved brand: ${brand.name}`);
          } catch (dbError) {
            errorCount++;
            console.error(`❌ Failed to save brand: ${brand.name}`, dbError.message);
          }
        }

        // Delay between pages
        await delay(CONFIG.SCRAPE_DELAY);
      } catch (pageError) {
        errorCount++;
        console.error(`❌ Failed to scrape page ${page}:`, pageError.message);
        // Continue with next page
      }
    }

    res.json({ 
      message: "✅ Brand scraping completed",
      success: successCount,
      errors: errorCount,
      total: successCount + errorCount
    });
  } catch (error) {
    console.error("❌ Fatal error during brand scraping:", error);
    res.status(500).json({ 
      error: "Brand scraping failed", 
      message: error.message 
    });
  }
});

/**
 * Scrape medicine details for all brands
 */
app.get("/scrape-details", async (req, res) => {
  let successCount = 0;
  let errorCount = 0;
  let retryCount = 0;
  let stoppedEarly = false;

  try {
    const brands = await Brand.find({ isDetails: false }, { link: 1, _id: 1 });
    console.log(`🧾 Found ${brands.length} brands pending detail scraping`);

    if (brands.length === 0) {
      return res.json({ 
        message: "✅ No brands to scrape. All details already collected.",
        success: 0,
        errors: 0
      });
    }

    for (const brand of brands) {
      if (!brand.link) {
        console.warn(`⚠️ Brand ${brand._id} has no link, skipping`);
        continue;
      }

      try {
        let detailData = await scrapeMedicineDetails(brand.link, brand._id);

        // Retry once if first attempt fails
        if (!detailData) {
          console.warn(`⚠️ First attempt failed for ${brand.link}. Retrying...`);
          await delay(10000); // Wait 3 seconds before retry
          
          detailData = await scrapeMedicineDetails(brand.link, brand._id);
          
          if (detailData) {
            retryCount++;
            console.log(`✅ First Retry successful for ${brand.link}`);
          }
        }

          // Retry once if first attempt fails
        if (!detailData) {
          console.warn(`⚠️ second attempt failed for ${brand.link}. Retrying...`);
          await delay(30000); // Wait 3 seconds before retry
          
          detailData = await scrapeMedicineDetails(brand.link, brand._id);
          
          if (detailData) {
            retryCount++;
            console.log(`✅ second Retry successful for ${brand.link}`);
          }
        }

        // Stop if both attempts fail
        if (!detailData) {
          console.error(`❌ Failed to scrape details for ${brand.link} after retry. Stopping operation.`);
          stoppedEarly = true;
          errorCount++;
          break;
        }

        // Save medicine details
        await Medicine.updateOne(
          { url: detailData.url },
          { $set: detailData },
          { upsert: true }
        );

        // Mark brand as completed
        await Brand.updateOne(
          { _id: brand._id },
          { $set: { isDetails: true } }
        );

        successCount++;
        console.log(`✅ [${successCount}/${brands.length}] Saved medicine: ${detailData.name}`);

        // Delay between requests
        await delay(CONFIG.SCRAPE_DELAY);

      } catch (detailError) {
        errorCount++;
        console.error(`❌ Error processing brand ${brand.link}:`, detailError.message);
        stoppedEarly = true;
        break;
      }
    }

    const response = {
      message: stoppedEarly 
        ? "⚠️ Medicine detail scraping stopped due to errors"
        : "✅ Medicine detail scraping completed",
      success: successCount,
      errors: errorCount,
      retries: retryCount,
      total: brands.length,
      stoppedEarly
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Fatal error during detail scraping:", error);
    res.status(500).json({ 
      error: "Detail scraping failed", 
      message: error.message,
      success: successCount,
      errors: errorCount,
      retries: retryCount
    });
  }
});

/**
 * Reset all brands isDetails to specified value
 * Adds isDetails field if it doesn't exist
 * Query param: value (true/false), defaults to false
 * Example: /reset-brand-status?value=true
 */
app.patch("/reset-brand-status", async (req, res) => {
  try {
    const { value } = req.query;
    
    // Default to false if not provided
    const isDetailsValue = value === 'true' || value === true;

    // Update all brands, adding isDetails field if it doesn't exist
    const result = await Brand.updateMany(
      {},
      { $set: { isDetails: isDetailsValue } },
      { upsert: false } // Don't create new documents, just update existing
    );

    // Count brands that didn't have isDetails field before
    const brandsWithoutField = await Brand.countDocuments({ 
      isDetails: { $exists: false } 
    });

    res.json({
      message: `✅ All brands updated to isDetails: ${isDetailsValue}`,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      addedField: result.matchedCount - (result.modifiedCount - brandsWithoutField),
      isDetails: isDetailsValue
    });
  } catch (error) {
    console.error("❌ Error resetting brand status:", error.message);
    res.status(500).json({ 
      error: "Reset failed",
      message: error.message 
    });
  }
});

/**
 * Get scraping statistics
 */
app.get("/stats", async (req, res) => {
  try {
    const totalBrands = await Brand.countDocuments();
    const completedBrands = await Brand.countDocuments({ isDetails: true });
    const totalMedicines = await Medicine.countDocuments();

    res.json({
      brands: {
        total: totalBrands,
        completed: completedBrands,
        pending: totalBrands - completedBrands,
        completionRate: totalBrands > 0 ? ((completedBrands / totalBrands) * 100).toFixed(2) + '%' : '0%'
      },
      medicines: {
        total: totalMedicines
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 🚀 SERVER STARTUP
// ============================================
const server = app.listen(CONFIG.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${CONFIG.PORT}`);
  console.log(`📊 Stats available at http://localhost:${CONFIG.PORT}/stats`);
  console.log(`❤️  Health check at http://localhost:${CONFIG.PORT}/health`);
});

// ============================================
// 🛑 GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, closing server gracefully...');
  server.close(async () => {
    await mongoose.connection.close();
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, closing server gracefully...');
  server.close(async () => {
    await mongoose.connection.close();
    console.log('✅ Server closed');
    process.exit(0);
  });
});