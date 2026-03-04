/**
 * Universal Product Selector for B2A Experiment
 * 
 * Usage:
 *   node scripts/select_products.js <category> <search_keywords> [min_reviews]
 * 
 * Examples:
 *   node scripts/select_products.js All_Beauty "serum,essence" 200
 *   node scripts/select_products.js Electronics "wireless earbuds,bluetooth earphones" 500
 *   node scripts/select_products.js Grocery_and_Gourmet_Food "protein bar,energy bar" 300
 *   node scripts/select_products.js Clothing_Shoes_and_Jewelry "running shoes,sneakers" 500
 *   node scripts/select_products.js Home_and_Kitchen "air purifier" 500
 *   node scripts/select_products.js Health_and_Household "vitamin,supplement" 300
 *   node scripts/select_products.js Sports_and_Outdoors "yoga mat" 300
 *   node scripts/select_products.js Toys_and_Games "board game,card game" 300
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function main() {
  const category = process.argv[2];
  const keywords = (process.argv[3] || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  const minReviews = parseInt(process.argv[4]) || 200;
  
  if (!category || keywords.length === 0) {
    console.log('Usage: node select_products.js <category> <keywords_comma_separated> [min_reviews]');
    console.log('');
    console.log('Available categories (check data/amazon_meta/ for downloaded files):');
    const metaDir = path.join(__dirname, '..', 'data', 'amazon_meta');
    if (fs.existsSync(metaDir)) {
      fs.readdirSync(metaDir).filter(f => f.endsWith('.jsonl')).forEach(f => {
        console.log('  ' + f.replace('meta_', '').replace('.jsonl', ''));
      });
    }
    // Also check project root for legacy files
    const rootFiles = fs.readdirSync(path.join(__dirname, '..')).filter(f => f.startsWith('meta_') && f.endsWith('.jsonl'));
    rootFiles.forEach(f => console.log('  ' + f.replace('meta_', '').replace('.jsonl', '') + ' (in project root)'));
    return;
  }
  
  // Find the metadata file
  let filePath = path.join(__dirname, '..', 'data', 'amazon_meta', `meta_${category}.jsonl`);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', `meta_${category}.jsonl`);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: meta_${category}.jsonl`);
    console.error('Run: bash scripts/download_categories.sh');
    return;
  }
  
  console.log(`\n📦 Category: ${category}`);
  console.log(`🔍 Keywords: ${keywords.join(', ')}`);
  console.log(`📊 Min reviews: ${minReviews}`);
  console.log(`📁 File: ${filePath}\n`);
  
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
  const candidates = [];
  let totalLines = 0;
  
  for await (const line of rl) {
    totalLines++;
    const item = JSON.parse(line);
    const title = (item.title || '').toLowerCase();
    
    // Must match at least one keyword
    if (!keywords.some(kw => title.includes(kw))) continue;
    
    // Optional: exclude keywords (passed as 4th arg, comma-separated)
    const excludeKeywords = (process.argv[5] || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    if (excludeKeywords.length > 0 && excludeKeywords.some(kw => title.includes(kw))) continue;
    
    const rating = item.average_rating || 0;
    const reviews = item.rating_number || 0;
    const images = item.images || [];
    
    // Extract best image URL
    let imgUrl = null;
    for (const img of images) {
      if (img && img.variant === 'MAIN') {
        imgUrl = img.hi_res || img.large;
        break;
      }
    }
    if (!imgUrl) {
      for (const img of images) {
        if (img) {
          imgUrl = img.hi_res || img.large;
          if (imgUrl) break;
        }
      }
    }
    
    const store = item.store || '';
    const price = item.price;
    const details = item.details || {};
    const features = item.features || [];
    const description = item.description || [];
    
    if (rating >= 4.0 && reviews >= minReviews && imgUrl && store) {
      candidates.push({
        asin: item.parent_asin,
        title: item.title,
        store,
        rating,
        reviews,
        price: price != null ? String(price) : 'None',
        image: imgUrl,
        features: features.slice(0, 3),
        description: (description[0] || '').slice(0, 200),
        brand: details.Brand || details.brand || store,
      });
    }
  }
  
  candidates.sort((a, b) => b.reviews - a.reviews);
  
  console.log(`Scanned ${totalLines.toLocaleString()} items → Found ${candidates.length} candidates\n`);
  
  if (candidates.length === 0) {
    console.log('No results. Try broader keywords or lower min_reviews.');
    return;
  }
  
  // Display top 30
  console.log('Top candidates:');
  console.log('─'.repeat(120));
  candidates.slice(0, 30).forEach((s, i) => {
    console.log(
      `${String(i+1).padStart(2)}. [${String(s.reviews).padStart(6)} reviews] ${s.rating}★ ` +
      `${s.price.padStart(8)} | ${s.store.slice(0,20).padEnd(20)} | ${s.title.slice(0,60)}`
    );
  });
  
  // Save candidates
  const outFile = path.join(__dirname, '..', `candidates_${category}.json`);
  fs.writeFileSync(outFile, JSON.stringify(candidates.slice(0, 50), null, 2));
  console.log(`\n✅ Saved top 50 to ${outFile}`);
  
  // Also generate a suggested 8-product selection (diverse stores, similar ratings)
  console.log('\n═══ Suggested 8 Products (diverse brands) ═══\n');
  const selected = [];
  const usedStores = new Set();
  
  for (const c of candidates) {
    if (selected.length >= 8) break;
    const storeLower = c.store.toLowerCase();
    if (usedStores.has(storeLower)) continue;
    usedStores.add(storeLower);
    selected.push(c);
  }
  
  // If not enough unique stores, fill from top
  if (selected.length < 8) {
    for (const c of candidates) {
      if (selected.length >= 8) break;
      if (!selected.includes(c)) selected.push(c);
    }
  }
  
  selected.forEach((s, i) => {
    console.log(`  ${i+1}. ${s.store} — ${s.title.slice(0,55)}`);
    console.log(`     ${s.rating}★ · ${s.reviews} reviews · $${s.price} · ASIN: ${s.asin}`);
    console.log(`     img: ${s.image}`);
    console.log('');
  });
  
  // Save selected 8 for direct use
  const selectFile = path.join(__dirname, '..', `selected_${category}.json`);
  fs.writeFileSync(selectFile, JSON.stringify(selected.slice(0, 8), null, 2));
  console.log(`✅ Saved 8 selected to ${selectFile}`);
}

main().catch(console.error);
