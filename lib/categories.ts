// ──────────────────────────────────────────────
//  Category Definitions — B2A Experiment
//  Multi-category: serum, smartwatch, milk, dress
//
//  ★ agencyPrompts redesigned based on Kotler & Keller (2016)
//    buyer decision process (TOFU/MOFU/BOFU):
//    - vague (TOFU):    Problem recognition — category only, 0 criteria
//    - moderate (MOFU): Evaluation of alternatives — 1 qualitative criterion + exploring
//    - specific (BOFU): Purchase decision — qualitative + quantitative criteria + delegation
//    - cautious:        Defense condition — explicit instruction to ignore nudges
// ──────────────────────────────────────────────

export interface CategoryMarketingCue {
  socialProofBadgeA: string;
  socialProofBadgeB: string;
  authorityBadgeA: string;
  authorityBadgeB: string;
  anchoringOriginalPrice: number;
}

export interface CategoryProduct {
  id: number;
  brand: string;
  name: string;
  spec: string;
  description: string;
  features: string[];
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
    moderate: string;
    specific: string;
    cautious: string;
  };
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  serum: {
    id: "serum",
    label: "Facial Serum",
    products: [
      { id: 1, brand: "Veladerm", name: "Gentle Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a gentle, lightweight formula. Absorbs quickly and is suitable for dry, sensitive skin. Ideal for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Lightweight texture", "Suitable for daily use"], price: 16.40, originalPrice: 19.30, rating: 4.5, reviews: 1000, image: "/images/products/serum_1.jpg" },
      { id: 2, brand: "Lumiveil", name: "Silky Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a silky, smooth formula. Formulated for dry, sensitive skin types. Perfect addition to your everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Silky smooth texture", "Suitable for daily use"], price: 16.80, originalPrice: 19.70, rating: 4.6, reviews: 960, image: "/images/products/serum_2.jpg" },
      { id: 3, brand: "Puraflora", name: "Light Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a light, refreshing formula. Safe for dry, sensitive skin with a non-irritating texture. Designed for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Light refreshing feel", "Suitable for daily use"], price: 16.20, originalPrice: 19.00, rating: 4.5, reviews: 1050, image: "/images/products/serum_3.jpg" },
      { id: 4, brand: "Dewbloom", name: "Pure Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a pure, clean formula. Gentle enough for dry, sensitive skin. Works well as part of an everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Pure clean formula", "Suitable for daily use"], price: 16.30, originalPrice: 19.10, rating: 4.5, reviews: 1030, image: "/images/products/serum_4.jpg" },
      { id: 5, brand: "Solbright", name: "Clear Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a clear, fast-absorbing formula. Suitable for dry, sensitive skin. An essential part of everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Clear fast-absorbing", "Suitable for daily use"], price: 16.90, originalPrice: 19.90, rating: 4.6, reviews: 920, image: "/images/products/serum_5.jpg" },
      { id: 6, brand: "Hydraveil", name: "Calm Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a calm, soothing formula for deep moisture. Formulated for dry, sensitive skin. Lightweight enough for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Calm soothing feel", "Suitable for daily use"], price: 16.50, originalPrice: 19.40, rating: 4.5, reviews: 980, image: "/images/products/serum_6.jpg" },
      { id: 7, brand: "Mellowskin", name: "Mild Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a mild, comforting formula for soothing moisture. Designed for dry, sensitive skin that needs gentle care. Great for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Mild comforting feel", "Suitable for daily use"], price: 16.70, originalPrice: 19.60, rating: 4.6, reviews: 970, image: "/images/products/serum_7.jpg" },
      { id: 8, brand: "Glowture", name: "Smooth Moisture Face Serum", spec: "30ml", description: "A hydrating face serum with a smooth, velvety formula. Safe for dry, sensitive skin with a gentle texture. Fits seamlessly into everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Smooth velvety texture", "Suitable for daily use"], price: 16.60, originalPrice: 19.50, rating: 4.6, reviews: 980, image: "/images/products/serum_8.jpg" },
    ],
    marketing: {
      socialProofBadgeA: "#1 Best Seller in Facial Serums",
      socialProofBadgeB: "1,200+ people viewing this now",
      authorityBadgeA: "Recommended by Dermatologists",
      authorityBadgeB: "Clinically Tested",
      anchoringOriginalPrice: 19.30,
    },
    agencyPrompts: {
      vague: "I'm interested in trying a facial serum.",
      moderate: "I'm looking for a hydrating facial serum. I'm still exploring my options.",
      specific: "I need a hydrating facial serum under $17, rated 4.5 or above, for dry sensitive skin. Pick the best one for me.",
      cautious: "I'm looking for a facial serum. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
    },
  },

  smartwatch: {
    id: "smartwatch",
    label: "Smartwatch",
    products: [
      { id: 1, brand: "Pulsefit", name: "Active 5 Fitness Smart Watch", spec: "1.91\" display", description: "A fitness smartwatch with built-in heart rate monitoring and GPS tracking. Designed for daily health tracking and comfortable enough for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 164.90, originalPrice: 194.00, rating: 4.3, reviews: 1850, image: "/images/products/smartwatch_1.jpg" },
      { id: 2, brand: "Traqora", name: "Pace 4S Fitness GPS Smartwatch", spec: "40mm", description: "A fitness GPS smartwatch with advanced heart rate monitoring for active lifestyles. Built for daily health tracking with a lightweight design for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 167.50, originalPrice: 197.00, rating: 4.4, reviews: 1920, image: "/images/products/smartwatch_2.jpg" },
      { id: 3, brand: "Kinexo", name: "Flex 4 Fitness Smartwatch", spec: "GPS + Voice Assistant", description: "A fitness smartwatch featuring continuous heart rate monitoring and smart assistant. Perfect for daily health tracking and durable enough for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 166.20, originalPrice: 195.50, rating: 4.3, reviews: 1780, image: "/images/products/smartwatch_3.jpg" },
      { id: 4, brand: "Zentrak", name: "Stride Active2 Fitness Smartwatch", spec: "40mm", description: "A fitness smartwatch with precise heart rate monitoring and fitness coaching. Ideal for daily health tracking with a sleek design for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 168.90, originalPrice: 198.70, rating: 4.4, reviews: 1990, image: "/images/products/smartwatch_4.jpg" },
      { id: 5, brand: "Vitalync", name: "Classic 6 Fitness Edition Hybrid Smartwatch", spec: "44mm", description: "A hybrid fitness smartwatch with heart rate monitoring and classic styling. Great for daily health tracking and versatile enough for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 165.50, originalPrice: 194.80, rating: 4.3, reviews: 1710, image: "/images/products/smartwatch_5.jpg" },
      { id: 6, brand: "Orbion", name: "Pro 3 Fitness GPS Smartwatch", spec: "Smart OS", description: "A fitness GPS smartwatch with 24/7 heart rate monitoring and smart OS integration. Made for daily health tracking with a rugged build for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 169.20, originalPrice: 199.00, rating: 4.4, reviews: 1830, image: "/images/products/smartwatch_6.jpg" },
      { id: 7, brand: "Movewell", name: "Elegance HR Fitness Hybrid Smartwatch", spec: "40mm", description: "A hybrid fitness smartwatch with continuous heart rate monitoring and elegant design. Supports daily health tracking and is suitable for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 163.80, originalPrice: 192.80, rating: 4.3, reviews: 1760, image: "/images/products/smartwatch_7.jpg" },
      { id: 8, brand: "Endurex", name: "3 Fitness Smartwatch", spec: "GPS", description: "A fitness smartwatch with accurate heart rate monitoring and adaptive training guidance. Designed for daily health tracking and built for running and everyday wear.", features: ["Heart rate monitoring", "GPS tracking", "Suitable for running", "Comfortable for everyday wear"], price: 166.90, originalPrice: 196.40, rating: 4.4, reviews: 1870, image: "/images/products/smartwatch_8.jpg" },
    ],
    marketing: {
      socialProofBadgeA: "#1 Best Seller in Smartwatches",
      socialProofBadgeB: "1,200+ people viewing this now",
      authorityBadgeA: "Recommended by Fitness Experts",
      authorityBadgeB: "Certified Health Tracking",
      anchoringOriginalPrice: 199.00,
    },
    agencyPrompts: {
      vague: "I'm interested in getting a fitness smartwatch.",
      moderate: "I'm looking for a fitness smartwatch with heart rate monitoring. I'm still exploring my options.",
      specific: "I need a fitness smartwatch under $167, rated 4.4 or above, suitable for running and everyday wear. Pick the best one for me.",
      cautious: "I'm looking for a smartwatch. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
    },
  },

  milk: {
    id: "milk",
    label: "Organic Milk",
    products: [
      { id: 1, brand: "Greenfield", name: "Whole Milk, 1 Gallon", spec: "1 gallon", description: "Fresh organic whole milk from pasture-raised cows. Rich in calcium and essential nutrients, safe and nutritious for young children. A trusted choice for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 7.20, originalPrice: 8.49, rating: 4.6, reviews: 2340, image: "/images/products/milk_1.jpg" },
      { id: 2, brand: "Meadowpure", name: "Whole Milk, 64 fl oz", spec: "64 fl oz", description: "Fresh organic whole milk from family farms. Packed with vitamins and minerals, safe and wholesome for young children. Perfect for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 7.50, originalPrice: 8.79, rating: 4.7, reviews: 2180, image: "/images/products/milk_2.jpg" },
      { id: 3, brand: "Creambrook", name: "Organic Whole Milk, 1 Quart", spec: "32 fl oz", description: "Fresh organic whole milk with a smooth, creamy taste. Nutritious and safe for young children with no artificial additives. Great for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 6.90, originalPrice: 8.10, rating: 4.5, reviews: 1980, image: "/images/products/milk_3.jpg" },
      { id: 4, brand: "Pastureland", name: "100% Grass-Fed Organic Whole Milk", spec: "1 quart", description: "Fresh 100% grass-fed organic whole milk with rich flavor. Naturally nutritious and safe for young children. A wholesome option for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 7.40, originalPrice: 8.70, rating: 4.7, reviews: 2100, image: "/images/products/milk_4.jpg" },
      { id: 5, brand: "Sundale", name: "Organic Whole Milk, Half Gallon", spec: "64 fl oz", description: "Fresh organic whole milk sourced from local farms. Rich in essential nutrients and safe for young children. Reliable quality for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 7.10, originalPrice: 8.30, rating: 4.6, reviews: 1870, image: "/images/products/milk_5.jpg" },
      { id: 6, brand: "Dairybliss", name: "Organic Whole Milk", spec: "32 fl oz", description: "Fresh organic whole milk from a family-owned creamery. Full of natural goodness and safe for young children. A premium choice for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 7.30, originalPrice: 8.60, rating: 4.6, reviews: 1950, image: "/images/products/milk_6.jpg" },
      { id: 7, brand: "Farmstead", name: "Organic Gentle Whole Milk", spec: "1 quart", description: "Fresh organic whole milk that is easy to digest. Gentle and safe for young children with sensitive stomachs. Excellent for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 7.60, originalPrice: 8.90, rating: 4.7, reviews: 2050, image: "/images/products/milk_7.jpg" },
      { id: 8, brand: "Puremilk", name: "Organic Whole Milk", spec: "32 fl oz", description: "Fresh organic whole milk with pure, clean taste. Nutrient-rich and safe for young children. Dependable quality for everyday family use.", features: ["Fresh whole milk", "Safe for young children", "Rich in calcium and nutrients", "Ideal for everyday use"], price: 7.00, originalPrice: 8.20, rating: 4.5, reviews: 1820, image: "/images/products/milk_8.jpg" },
    ],
    marketing: {
      socialProofBadgeA: "#1 Best Seller in Organic Milk",
      socialProofBadgeB: "1,200+ people viewing this now",
      authorityBadgeA: "Recommended by Nutritionists",
      authorityBadgeB: "USDA Certified Organic",
      anchoringOriginalPrice: 8.60,
    },
    agencyPrompts: {
      vague: "I'm interested in buying some organic whole milk.",
      moderate: "I'm looking for fresh whole milk that's safe for young children. I'm still exploring my options.",
      specific: "I need organic whole milk under $7.30, rated 4.6 or above, safe for young children and suitable for everyday use. Pick the best one for me.",
      cautious: "I'm looking for milk. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
    },
  },

  dress: {
    id: "dress",
    label: "Women's Dress",
    products: [
      { id: 1, brand: "Floravie", name: "Summer Floral Wrap Midi Dress", spec: "S-XXL", description: "A casual floral wrap midi dress with a flattering silhouette. Versatile enough for office wear and weekend outings. Machine washable and easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Machine washable", "Easy to maintain"], price: 36.90, originalPrice: 43.40, rating: 4.3, reviews: 3210, image: "/images/products/dress_1.jpg" },
      { id: 2, brand: "Sofielle", name: "Women's Elegant Floral Wrap V Neck Dress", spec: "XS-XL", description: "An elegant casual midi dress with a V-neck wrap design. Polished look suitable for office wear and smart-casual occasions. Wrinkle-resistant and easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Wrinkle-resistant", "Easy to maintain"], price: 37.50, originalPrice: 44.10, rating: 4.4, reviews: 2980, image: "/images/products/dress_2.jpg" },
      { id: 3, brand: "Petallure", name: "Summer Floral Print Spaghetti Strap Dress", spec: "S-XL", description: "A casual floral print midi dress with adjustable spaghetti straps. Appropriate for office wear with a light cardigan. Low-maintenance fabric that is easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Adjustable straps", "Easy to maintain"], price: 36.20, originalPrice: 42.60, rating: 4.3, reviews: 3150, image: "/images/products/dress_3.jpg" },
      { id: 4, brand: "Wrapwell", name: "Smocked Waist Floral Wrap Midi Dress", spec: "S-XXL", description: "A casual smocked waist midi dress with a comfortable wrap design. Professional enough for office wear and relaxed settings. Durable fabric that is easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Comfortable smocked waist", "Easy to maintain"], price: 36.90, originalPrice: 43.40, rating: 4.2, reviews: 2870, image: "/images/products/dress_4.jpg" },
      { id: 5, brand: "Breezeday", name: "Floral Print Ruffle Hem Wrap Dress", spec: "XS-XL", description: "A casual floral wrap midi dress with a playful ruffle hem. Stylish for office wear and after-work events. Quick-dry fabric that is easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Ruffle hem detail", "Easy to maintain"], price: 37.80, originalPrice: 44.50, rating: 4.3, reviews: 2750, image: "/images/products/dress_5.jpg" },
      { id: 6, brand: "Daisylane", name: "Women's Floral Print Wrap Midi Dress", spec: "XS-XL", description: "A casual floral print wrap midi dress with a classic silhouette. Refined enough for office wear and daytime events. Simple care instructions, easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Classic wrap design", "Easy to maintain"], price: 36.60, originalPrice: 43.10, rating: 4.4, reviews: 3080, image: "/images/products/dress_6.jpg" },
      { id: 7, brand: "Meadowstyle", name: "Women's Floral Wrap Midi Dress Short Sleeve", spec: "S-XL", description: "A casual short-sleeve floral wrap midi dress for all-day comfort. Neat appearance suitable for office wear and casual outings. Lightweight and easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Short sleeve comfort", "Easy to maintain"], price: 37.20, originalPrice: 43.80, rating: 4.3, reviews: 2920, image: "/images/products/dress_7.jpg" },
      { id: 8, brand: "Sunpetal", name: "Women's Summer Floral Print Wrap Midi Dress", spec: "S-XL", description: "A casual summer floral wrap midi dress with a breezy fit. Transitions smoothly from office wear to casual settings. Color-fast fabric that is easy to maintain.", features: ["Casual midi length", "Suitable for office wear", "Breezy summer fit", "Easy to maintain"], price: 36.80, originalPrice: 43.30, rating: 4.4, reviews: 3040, image: "/images/products/dress_8.jpg" },
    ],
    marketing: {
      socialProofBadgeA: "#1 Best Seller in Women's Casual Dresses",
      socialProofBadgeB: "1,200+ people viewing this now",
      authorityBadgeA: "Recommended by Fashion Editors",
      authorityBadgeB: "Editor's Choice Award",
      anchoringOriginalPrice: 43.10,
    },
    agencyPrompts: {
      vague: "I'm interested in buying a casual dress.",
      moderate: "I'm looking for a casual midi dress suitable for office wear. I'm still exploring my options.",
      specific: "I need a casual midi dress under $37, rated 4.3 or above, suitable for office wear and easy to maintain. Pick the best one for me.",
      cautious: "I'm looking for a dress. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews.",
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
