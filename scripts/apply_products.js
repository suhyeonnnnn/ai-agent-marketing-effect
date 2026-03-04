/**
 * Apply selected products to B2A experiment
 * Reads selected_<category>.json and generates products config
 * 
 * Usage:
 *   node scripts/apply_products.js <category>
 * 
 * This will:
 *   1. Read selected_<category>.json (8 products)
 *   2. Equalize prices/ratings for experiment validity  
 *   3. Generate lib/products_<category>.ts
 *   4. Output a summary
 */

const fs = require('fs');
const path = require('path');

function main() {
  const category = process.argv[2];
  if (!category) {
    console.log('Usage: node apply_products.js <category>');
    console.log('Requires: selected_<category>.json from select_products.js');
    return;
  }
  
  const selectFile = path.join(__dirname, '..', `selected_${category}.json`);
  if (!fs.existsSync(selectFile)) {
    console.error(`Not found: ${selectFile}`);
    console.error('Run select_products.js first.');
    return;
  }
  
  const products = JSON.parse(fs.readFileSync(selectFile, 'utf-8'));
  
  // Equalize attributes for experiment (eliminate confounds)
  // Use actual images and titles, but normalize price/rating/reviews
  const basePrice = 16.50;
  const priceRange = 1.00; // $15.90 - $16.90
  const baseRating = 4.5;
  const ratingVariance = 0.1; // 4.5 - 4.6
  const baseReviews = 1000;
  const reviewVariance = 50;
  
  const equalizedProducts = products.map((p, i) => {
    const price = +(basePrice + (Math.random() * priceRange - priceRange/2)).toFixed(2);
    const origPrice = +(price / 0.85).toFixed(2); // ~15% discount
    const rating = +(baseRating + (i % 2 === 0 ? 0 : ratingVariance)).toFixed(1);
    const reviews = baseReviews + Math.round((Math.random() - 0.5) * reviewVariance * 2);
    
    return {
      id: i + 1,
      brand: p.brand || p.store,
      name: p.title,
      volume: '1 unit', // generic
      price,
      originalPrice: origPrice,
      discount: 15,
      rating,
      reviews,
      tags: ['Free Shipping'],
      image: p.image, // Real Amazon image URL
      color: [
        'from-blue-50 to-blue-100', 'from-green-50 to-green-100',
        'from-orange-50 to-orange-100', 'from-pink-50 to-pink-100',
        'from-indigo-50 to-indigo-100', 'from-purple-50 to-purple-100',
        'from-teal-50 to-teal-100', 'from-amber-50 to-amber-100',
      ][i],
      asin: p.asin, // For reference
      realPrice: p.price, // Original Amazon price
      realRating: p.rating,
      realReviews: p.reviews,
    };
  });
  
  console.log(`\n📦 Category: ${category}`);
  console.log(`📊 ${equalizedProducts.length} products equalized\n`);
  
  equalizedProducts.forEach((p, i) => {
    console.log(`  ${i+1}. [${p.brand}] ${p.name.slice(0,50)}`);
    console.log(`     Equalized: $${p.price} · ${p.rating}★ · ${p.reviews} reviews`);
    console.log(`     Real:      $${p.realPrice} · ${p.realRating}★ · ${p.realReviews} reviews`);
    console.log(`     Image: ${p.image.slice(0,70)}...`);
    console.log('');
  });
  
  // Save equalized products JSON
  const outFile = path.join(__dirname, '..', `products_${category}.json`);
  fs.writeFileSync(outFile, JSON.stringify(equalizedProducts, null, 2));
  console.log(`✅ Saved to ${outFile}`);
  console.log(`\nNext: Update lib/products.ts to import from this file, or`);
  console.log(`      add category selection to the experiment dashboard.`);
}

main();
