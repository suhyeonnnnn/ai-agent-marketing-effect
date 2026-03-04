const fs = require('fs');
const readline = require('readline');

async function main() {
  const filePath = require('path').join(__dirname, '..', 'meta_All_Beauty.jsonl');
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
  
  const serums = [];
  
  for await (const line of rl) {
    const item = JSON.parse(line);
    const title = (item.title || '').toLowerCase();
    
    if (!['serum', 'essence', 'ampoule'].some(kw => title.includes(kw))) continue;
    if (!['face', 'facial', 'hyaluronic', 'vitamin c', 'skin', 'anti-aging', 'moistur', 'hydrat', 'retinol', 'niacin', 'glow', 'wrinkle', 'dark spot', 'brightening'].some(kw => title.includes(kw))) continue;
    
    const rating = item.average_rating || 0;
    const reviews = item.rating_number || 0;
    const images = item.images || [];
    
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
    
    if (rating >= 4.0 && reviews >= 200 && imgUrl && store) {
      serums.push({
        asin: item.parent_asin,
        title: item.title,
        store,
        rating,
        reviews,
        price: price != null ? String(price) : 'None',
        image: imgUrl,
      });
    }
  }
  
  serums.sort((a, b) => b.reviews - a.reviews);
  
  console.log(`Found ${serums.length} serum candidates\n`);
  console.log('Top 30:');
  serums.slice(0, 30).forEach((s, i) => {
    console.log(`${String(i+1).padStart(2)}. [${String(s.reviews).padStart(6)} reviews] ${s.rating}★ ${s.price.padStart(8)} | ${s.store.slice(0,20).padEnd(20)} | ${s.title.slice(0,65)}`);
    console.log(`     img: ${s.image.slice(0,90)}`);
  });
  
  // Save top 30 as JSON for easy reference
  fs.writeFileSync(
    require('path').join(__dirname, '..', 'serum_candidates.json'),
    JSON.stringify(serums.slice(0, 30), null, 2)
  );
  console.log('\nSaved to serum_candidates.json');
}

main().catch(console.error);
