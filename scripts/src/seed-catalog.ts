import { categoriesTable, db, pool, productsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const imageByCategory: Record<string, string> = {
  diagnostic: "/products/product-diagnostic.jpg",
  laboratory: "/products/product-lab-glassware.jpg",
  nursing: "/products/product-scrubs.jpg",
  "patient-care": "/products/product-patient-care.jpg",
  ppe: "/products/product-ppe.jpg",
  surgical: "/products/product-surgical.jpg",
  "adult-care": "/products/product-adult-care.jpg",
  microscopes: "/products/product-microscope.jpg",
  centrifuges: "/products/product-centrifuge.jpg",
  "vital-signs": "/products/product-vital-signs.jpg",
};

const categoryDefinitions = [
  ["Diagnostic Equipment", "diagnostic", "Reliable tools for clinical examination and diagnosis."],
  ["Laboratory Supplies", "laboratory", "Laboratory consumables and glassware for accurate testing."],
  ["Nursing & Uniforms", "nursing", "Professional nursing uniforms and essential ward supplies."],
  ["Patient Care", "patient-care", "Comfort, mobility, and recovery products for patient care."],
  ["Personal Protective Equipment", "ppe", "Protective equipment for healthcare workers and patients."],
  ["Surgical Supplies", "surgical", "Sterile and non-sterile supplies for theatre and procedure rooms."],
  ["Adult Care", "adult-care", "Discreet, dependable continence and adult-care products."],
  ["Microscopes & Optics", "microscopes", "Optical instruments for education, research, and diagnostics."],
  ["Centrifuges & Processing", "centrifuges", "Sample preparation equipment for modern laboratories."],
  ["Vital Signs & Monitoring", "vital-signs", "Monitoring devices for clinics, wards, and home care."],
] as const;

const productGroups: Array<{
  category: (typeof categoryDefinitions)[number][1];
  names: string[];
  basePrice: number;
}> = [
  {
    category: "diagnostic",
    basePrice: 8500,
    names: [
      "Dual-Head Cardiology Stethoscope",
      "Professional Aneroid BP Monitor",
      "LED Penlight with Pupil Gauge",
      "Otoscope and Ophthalmoscope Set",
      "Portable Examination Lamp",
      "Digital Diagnostic Thermometer",
      "Reflex Hammer and Tuning Fork Set",
      "Manual Height and Weight Scale",
      "Handheld Fetal Doppler",
      "Non-Contact Infrared Thermometer",
    ],
  },
  {
    category: "laboratory",
    basePrice: 3200,
    names: [
      "Disposable Transfer Pipette Pack",
      "Premium Microscope Slide Box",
      "Borosilicate Test Tube Set",
      "Laboratory Measuring Cylinder",
      "Glass Beaker Assortment",
      "Universal Specimen Container",
      "Adjustable Micropipette",
      "Laboratory Safety Wash Bottle",
      "Reusable Petri Dish Set",
      "Digital Laboratory Timer",
    ],
  },
  {
    category: "nursing",
    basePrice: 9500,
    names: [
      "Classic Navy Nurses Scrubs",
      "Royal Blue V-Neck Scrub Set",
      "Unisex Medical Scrub Trousers",
      "White Clinical Lab Coat",
      "Nursing Theatre Cap",
      "Adjustable Clinical Waist Pouch",
      "Nurse Fob Watch",
      "Compression Support Stockings",
      "Reusable Nursing Shoe Covers",
      "Medical Uniform Name Badge",
    ],
  },
  {
    category: "patient-care",
    basePrice: 6800,
    names: [
      "Adjustable Aluminium Walking Stick",
      "Foldable Patient Walker",
      "Transfer Wheelchair",
      "Hospital Bedside Locker",
      "Four-Section Manual Hospital Bed",
      "Anti-Bedsore Air Mattress",
      "Reusable Hot and Cold Pack",
      "Patient Positioning Wedge",
      "Digital Medication Organizer",
      "Folding Examination Couch",
    ],
  },
  {
    category: "ppe",
    basePrice: 1800,
    names: [
      "Nitrile Examination Gloves Box",
      "Latex Examination Gloves Box",
      "KN95 Protective Face Masks",
      "Three-Ply Surgical Face Masks",
      "Disposable Bouffant Caps",
      "Disposable Shoe Covers",
      "Reusable Protective Gown",
      "Safety Goggles",
      "Face Shield with Adjustable Headband",
      "Heavy-Duty Nitrile Utility Gloves",
    ],
  },
  {
    category: "surgical",
    basePrice: 4200,
    names: [
      "Sterile Surgical Blade Pack",
      "Disposable Surgical Gown",
      "Sterile Gauze Swab Pack",
      "Surgical Dressing Tray",
      "Kelly Artery Forceps",
      "Adson Tissue Forceps",
      "Mayo Scissors",
      "Surgical Needle Holder",
      "Sterile Suture Pack",
      "Disposable Procedure Drape",
    ],
  },
  {
    category: "adult-care",
    basePrice: 7200,
    names: [
      "Adult Briefs Medium Pack",
      "Adult Briefs Large Pack",
      "Adult Briefs Extra Large Pack",
      "Adult Pull-Up Pants Medium",
      "Adult Pull-Up Pants Large",
      "Reusable Waterproof Bed Pad",
      "Disposable Underpad Pack",
      "Skin-Friendly Barrier Cream",
      "No-Rinse Cleansing Foam",
      "Adult Care Odour-Control Bags",
    ],
  },
  {
    category: "microscopes",
    basePrice: 185000,
    names: [
      "Student Monocular Microscope",
      "Binocular Laboratory Microscope",
      "LED Digital Microscope",
      "Teaching Microscope Camera",
      "Microscope Immersion Oil",
      "Microscope Cleaning Kit",
      "Prepared Biology Slide Set",
      "Microscope Eyepiece Pair",
      "Microscope Mechanical Stage",
      "Portable USB Microscope",
    ],
  },
  {
    category: "centrifuges",
    basePrice: 145000,
    names: [
      "Benchtop Clinical Centrifuge",
      "Digital Variable-Speed Centrifuge",
      "Mini PRP Centrifuge",
      "Laboratory Microcentrifuge",
      "Centrifuge Tube Rotor",
      "Universal Centrifuge Tube Rack",
      "Blood Collection Tube Mixer",
      "Laboratory Vortex Mixer",
      "Digital Water Bath",
      "Sample Preparation Workstation",
    ],
  },
  {
    category: "vital-signs",
    basePrice: 12500,
    names: [
      "Automatic Upper-Arm BP Monitor",
      "Fingertip Pulse Oximeter",
      "Patient Vital Signs Monitor",
      "Digital Baby Weighing Scale",
      "Medical Infrared Thermometer",
      "Portable ECG Monitor",
      "Manual Resuscitator Bag",
      "Portable Oxygen Concentrator",
      "Medical Nebulizer Machine",
      "Rechargeable Examination Monitor",
    ],
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedCatalog(): Promise<void> {
  await db
    .insert(categoriesTable)
    .values(
      categoryDefinitions.map(([name, slug, description]) => ({
        name,
        slug,
        description,
        imageUrl: imageByCategory[slug],
      })),
    )
    .onConflictDoNothing({ target: categoriesTable.slug });

  const categories = await db
    .select({ id: categoriesTable.id, slug: categoriesTable.slug })
    .from(categoriesTable)
    .where(inArray(categoriesTable.slug, categoryDefinitions.map(([, slug]) => slug)));
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));

  const products = productGroups.flatMap((group, groupIndex) => {
    const categoryId = categoryIds.get(group.category);
    if (!categoryId) throw new Error(`Missing category: ${group.category}`);
    return group.names.map((name, productIndex) => {
      const price = group.basePrice + productIndex * Math.max(500, Math.round(group.basePrice * 0.035));
      const slug = slugify(name);
      return {
        name,
        slug,
        description: `${name} supplied by Elite Care Medical for clinics, hospitals, laboratories, and home care. Contact our Lagos team for bulk and institutional orders.`,
        price: String(price),
        originalPrice: productIndex % 4 === 0 ? String(Math.round(price * 1.12)) : null,
        categoryId,
        imageUrl: imageByCategory[group.category],
        images: [imageByCategory[group.category]],
        inStock: true,
        isFeatured: groupIndex < 6 && productIndex < 2,
        brand: "Elite Care",
        model: `EC-${String(groupIndex + 1).padStart(2, "0")}-${String(productIndex + 1).padStart(2, "0")}`,
      };
    });
  });

  await db.insert(productsTable).values(products).onConflictDoNothing({ target: productsTable.slug });
  console.log(JSON.stringify({ categories: categories.length, products: products.length }));
}

seedCatalog()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });