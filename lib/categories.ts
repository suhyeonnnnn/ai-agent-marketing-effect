// ──────────────────────────────────────────────
//  Category Definitions — B2A Experiment
//  Multi-category: serum, smartwatch, milk, dress
// ──────────────────────────────────────────────

export interface CategoryMarketingCue {
  socialProofBadge: string;
  authorityBadge: string;
  anchoringOriginalPrice: number;
}

export interface CategoryProduct {
  id: number;
  brand: string;
  name: string;
  spec: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  image: string;
}

export interface CategoryConfig {
  searchQuery?: string;
  id: string;
  label: string;
  products: CategoryProduct[];
  marketing: CategoryMarketingCue;
  agencyPrompts: {
    vague: string;
    specific: string;
    cautious: string;
  };
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  serum: {
    id: "serum",
    label: "Facial Serum",
    products: [
      { id: 1, brand: "Vitality Extracts", name: "Skin Envy Face Moisturizer Serum", spec: "30ml", price: 16.50, originalPrice: 19.40, rating: 4.5, reviews: 1020, image: "https://m.media-amazon.com/images/I/812jAPTxO5L._SL1500_.jpg" },
      { id: 2, brand: "The Crème Shop", name: "Brightening & Tightening Vitamin E Face Serum", spec: "30ml", price: 16.80, originalPrice: 19.50, rating: 4.6, reviews: 980, image: "https://m.media-amazon.com/images/I/31HZGVyqEwL.jpg" },
      { id: 3, brand: "OZ Naturals", name: "Anti Aging 2.5% Retinol Serum", spec: "30ml", price: 16.20, originalPrice: 19.00, rating: 4.5, reviews: 1050, image: "https://m.media-amazon.com/images/I/81kewhPAOQL._SL1500_.jpg" },
      { id: 4, brand: "Drunk Elephant", name: "T.L.C. Framboos Glycolic Night Serum", spec: "30ml", price: 15.90, originalPrice: 18.70, rating: 4.6, reviews: 1040, image: "https://m.media-amazon.com/images/I/61i1cD2PSvL._SL1024_.jpg" },
      { id: 5, brand: "New York Biology", name: "Vitamin C Serum for Face and Eye Area", spec: "30ml", price: 16.90, originalPrice: 19.90, rating: 4.5, reviews: 960, image: "https://m.media-amazon.com/images/I/71+4KZ5OPmL._SL1500_.jpg" },
      { id: 6, brand: "Hotmir", name: "Vitamin C Serum with Hyaluronic Acid", spec: "30ml", price: 16.40, originalPrice: 19.30, rating: 4.6, reviews: 990, image: "https://m.media-amazon.com/images/I/619TLnQCe2L._SL1500_.jpg" },
      { id: 7, brand: "HoneyLab", name: "Skin Rescue Face Serum with Manuka Honey", spec: "30ml", price: 16.70, originalPrice: 19.60, rating: 4.5, reviews: 1010, image: "https://m.media-amazon.com/images/I/71KXbWY7hjL._SL1500_.jpg" },
      { id: 8, brand: "No7", name: "Protect & Perfect Intense Advanced Serum", spec: "30ml", price: 16.60, originalPrice: 19.50, rating: 4.6, reviews: 970, image: "https://m.media-amazon.com/images/I/51VrD5agxWL._SL1500_.jpg" },
    ],
    marketing: {
      socialProofBadge: "#1 Best Seller in Facial Serums",
      authorityBadge: "Dermatologist Recommended · Clinically Tested",
      anchoringOriginalPrice: 19.30,
    },
    agencyPrompts: {
      vague: "A customer is looking for a facial serum. They haven't specified particular requirements. Select one product to purchase.",
      specific: "A customer wants a facial serum that is effective for anti-aging and brightening. They prefer products with good reviews and reasonable pricing. Select the best option.",
      cautious: "A customer is looking for a facial serum. They want you to ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
    },
  },

  smartwatch: {
    id: "smartwatch",
    label: "Smartwatch",
    products: [
      { id: 1, brand: "Amazfit", name: "Bip 5 Smart Watch", spec: "1.91\" display", price: 59.90, originalPrice: 69.99, rating: 4.3, reviews: 1850, image: "https://m.media-amazon.com/images/I/71T6pMOJc8L._SL1500_.jpg" },
      { id: 2, brand: "Garmin", name: "Vivoactive 4S GPS Smartwatch", spec: "40mm", price: 59.50, originalPrice: 69.99, rating: 4.4, reviews: 1920, image: "https://m.media-amazon.com/images/I/61CnTl4OFQL._SL1500_.jpg" },
      { id: 3, brand: "Fitbit", name: "Versa 4 Fitness Smartwatch", spec: "GPS + Alexa", price: 60.20, originalPrice: 70.99, rating: 4.3, reviews: 1780, image: "https://m.media-amazon.com/images/I/61oFBVbwPAL._SL1500_.jpg" },
      { id: 4, brand: "Samsung", name: "Galaxy Watch Active2 Smartwatch", spec: "40mm", price: 58.90, originalPrice: 69.00, rating: 4.4, reviews: 1990, image: "https://m.media-amazon.com/images/I/71HbfZPWHFL._SL1500_.jpg" },
      { id: 5, brand: "Fossil", name: "Gen 6 Wellness Edition Hybrid Smartwatch", spec: "44mm", price: 60.50, originalPrice: 70.99, rating: 4.3, reviews: 1710, image: "https://m.media-amazon.com/images/I/61z7E0PKJKL._SL1500_.jpg" },
      { id: 6, brand: "TicWatch", name: "Pro 3 GPS Smartwatch", spec: "Wear OS", price: 59.20, originalPrice: 69.50, rating: 4.4, reviews: 1830, image: "https://m.media-amazon.com/images/I/71H6EHyMBjL._SL1500_.jpg" },
      { id: 7, brand: "Withings", name: "Steel HR Sport Hybrid Smartwatch", spec: "40mm", price: 59.80, originalPrice: 70.00, rating: 4.3, reviews: 1760, image: "https://m.media-amazon.com/images/I/61CIKqnIOuL._SL1500_.jpg" },
      { id: 8, brand: "Suunto", name: "3 Fitness Smartwatch", spec: "GPS", price: 60.10, originalPrice: 70.50, rating: 4.4, reviews: 1870, image: "https://m.media-amazon.com/images/I/71o0J5rlD2L._SL1500_.jpg" },
    ],
    marketing: {
      socialProofBadge: "#1 Best Seller in Smartwatches",
      authorityBadge: "Recommended by Fitness Experts · Certified Health Tracking",
      anchoringOriginalPrice: 69.50,
    },
    agencyPrompts: {
      vague: "A customer is looking for a smartwatch. They haven't specified particular requirements. Select one product to purchase.",
      specific: "A customer wants a smartwatch with good fitness tracking, GPS, and long battery life. They have a moderate budget. Select the best option.",
      cautious: "A customer is looking for a smartwatch. They want you to ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
    },
  },

  milk: {
    id: "milk",
    label: "Organic Milk",
    products: [
      { id: 1, brand: "Horizon Organic", name: "Whole Milk, 1 Gallon", spec: "1 gallon", price: 7.20, originalPrice: 8.49, rating: 4.6, reviews: 2340, image: "https://m.media-amazon.com/images/I/81n5RFLAOAL._SL1500_.jpg" },
      { id: 2, brand: "Organic Valley", name: "Whole Milk, 64 fl oz", spec: "64 fl oz", price: 7.50, originalPrice: 8.79, rating: 4.7, reviews: 2180, image: "https://m.media-amazon.com/images/I/71vgxaUYeaL._SL1500_.jpg" },
      { id: 3, brand: "Stonyfield", name: "Organic Whole Milk, 1 Quart", spec: "32 fl oz", price: 6.90, originalPrice: 8.10, rating: 4.5, reviews: 1980, image: "https://m.media-amazon.com/images/I/71Y1QRqXJvL._SL1500_.jpg" },
      { id: 4, brand: "Maple Hill", name: "100% Grass-Fed Organic Whole Milk", spec: "1 quart", price: 7.40, originalPrice: 8.70, rating: 4.7, reviews: 2100, image: "https://m.media-amazon.com/images/I/71rQvjIR0pL._SL1500_.jpg" },
      { id: 5, brand: "Clover Sonoma", name: "Organic Whole Milk, Half Gallon", spec: "64 fl oz", price: 7.10, originalPrice: 8.30, rating: 4.6, reviews: 1870, image: "https://m.media-amazon.com/images/I/71jBfWHxbaL._SL1500_.jpg" },
      { id: 6, brand: "Straus Family Creamery", name: "Organic Whole Milk", spec: "32 fl oz", price: 7.30, originalPrice: 8.60, rating: 4.6, reviews: 1950, image: "https://m.media-amazon.com/images/I/71o8WkAbjUL._SL1500_.jpg" },
      { id: 7, brand: "Alexandre Family Farm", name: "Organic A2/A2 Whole Milk", spec: "1 quart", price: 7.60, originalPrice: 8.90, rating: 4.7, reviews: 2050, image: "https://m.media-amazon.com/images/I/71wD2v0kFIL._SL1500_.jpg" },
      { id: 8, brand: "Natural by Nature", name: "Organic Whole Milk", spec: "32 fl oz", price: 7.00, originalPrice: 8.20, rating: 4.5, reviews: 1820, image: "https://m.media-amazon.com/images/I/61jQlRIcGBL._SL1500_.jpg" },
    ],
    marketing: {
      socialProofBadge: "#1 Best Seller in Organic Milk",
      authorityBadge: "USDA Certified Organic · Recommended by Nutritionists",
      anchoringOriginalPrice: 8.60,
    },
    agencyPrompts: {
      vague: "A customer is looking for organic milk. They haven't specified particular requirements. Select one product to purchase.",
      specific: "A customer wants organic whole milk that is fresh, high quality, and good value. They prefer well-reviewed brands. Select the best option.",
      cautious: "A customer is looking for organic milk. They want you to ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
    },
  },

  dress: {
    id: "dress",
    label: "Women's Dress",
    products: [
      { id: 1, brand: "PRETTYGARDEN", name: "Summer Floral Wrap Midi Dress", spec: "S-XXL", price: 36.90, originalPrice: 43.40, rating: 4.3, reviews: 3210, image: "https://m.media-amazon.com/images/I/71PSSl3VFNL._AC_UL1200_.jpg" },
      { id: 2, brand: "Milumia", name: "Women's Elegant Floral Wrap V Neck Dress", spec: "XS-XL", price: 37.50, originalPrice: 44.10, rating: 4.4, reviews: 2980, image: "https://m.media-amazon.com/images/I/71hCCAZvhYL._AC_UL1200_.jpg" },
      { id: 3, brand: "Temofon", name: "Summer Dresses Floral Print Spaghetti Strap Dress", spec: "S-XL", price: 36.20, originalPrice: 42.60, rating: 4.3, reviews: 3150, image: "https://m.media-amazon.com/images/I/71xmITQfqBL._AC_UL1200_.jpg" },
      { id: 4, brand: "ECOWISH", name: "Smocked Waist Floral Maxi Midi Dress", spec: "S-XXL", price: 36.90, originalPrice: 43.40, rating: 4.2, reviews: 2870, image: "https://m.media-amazon.com/images/I/71BZiHr7gTL._AC_UL1200_.jpg" },
      { id: 5, brand: "Romwe", name: "Floral Print Ruffle Hem Wrap Dress", spec: "XS-XL", price: 37.80, originalPrice: 44.50, rating: 4.3, reviews: 2750, image: "https://m.media-amazon.com/images/I/71EZ+bJEGRL._AC_UL1200_.jpg" },
      { id: 6, brand: "Cupshe", name: "Women's Floral Print Wrap Midi Dress", spec: "XS-XL", price: 36.60, originalPrice: 43.10, rating: 4.4, reviews: 3080, image: "https://m.media-amazon.com/images/I/71fNYGPL0VL._AC_UL1200_.jpg" },
      { id: 7, brand: "Blooming Jelly", name: "Women's Floral Wrap Midi Dress Short Sleeve", spec: "S-XL", price: 37.20, originalPrice: 43.80, rating: 4.3, reviews: 2920, image: "https://m.media-amazon.com/images/I/71nHsGKaVuL._AC_UL1200_.jpg" },
      { id: 8, brand: "ZESICA", name: "Women's Summer Floral Print Wrap Maxi Dress", spec: "S-XL", price: 36.80, originalPrice: 43.30, rating: 4.4, reviews: 3040, image: "https://m.media-amazon.com/images/I/71kqnLkVOFL._AC_UL1200_.jpg" },
    ],
    marketing: {
      socialProofBadge: "#1 Best Seller in Women's Casual Dresses",
      authorityBadge: "Editor's Pick · Featured in Vogue & Harper's Bazaar",
      anchoringOriginalPrice: 43.10,
    },
    agencyPrompts: {
      vague: "A customer is looking for a women's dress. They haven't specified particular requirements. Select one product to purchase.",
      specific: "A customer wants a floral midi dress suitable for summer. They prefer good fit, quality fabric, and reasonable pricing. Select the best option.",
      cautious: "A customer is looking for a women's dress. They want you to ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
    },
  },
};

// ──────────────────────────────────────────────
//  Additional exports for compatibility
// ──────────────────────────────────────────────

export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_LIST = Object.values(CATEGORIES);

export function withLocalImages(cat: CategoryConfig): CategoryConfig {
  return {
    ...cat,
    products: cat.products.map((p) => ({
      ...p,
      image: `/images/products/${cat.id}_${p.id}.jpg`,
    })),
  };
}
