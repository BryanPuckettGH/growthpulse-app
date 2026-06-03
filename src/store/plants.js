/* ============================================================
   plants.js
   A curated plant catalog. Each plant inherits its ideal ranges
   from its category archetype (most plants in a category share
   similar needs). Selecting a plant sets a device's target ranges,
   which drive status colors, health, alarms, and recommendations.

   Later (backend phase) this can be synced from a live botanical
   API, but a bundled catalog keeps it fast, offline, and key-free.
   ============================================================ */

// Category archetypes: ideal (good) and acceptable (warn) ranges + an icon.
export const PLANT_CATEGORIES = {
  houseplant: { label: 'Houseplants', emoji: '🪴', ranges: { soilMoisturePercent: { good: [40, 70], warn: [30, 80] }, airHumidity: { good: [40, 65], warn: [30, 78] }, airTemperatureF: { good: [65, 80], warn: [58, 88] } } },
  tropical: { label: 'Tropical & ferns', emoji: '🌿', ranges: { soilMoisturePercent: { good: [50, 80], warn: [40, 90] }, airHumidity: { good: [55, 85], warn: [45, 92] }, airTemperatureF: { good: [65, 82], warn: [58, 90] } } },
  succulent: { label: 'Succulents & cacti', emoji: '🌵', ranges: { soilMoisturePercent: { good: [5, 30], warn: [3, 45] }, airHumidity: { good: [20, 45], warn: [10, 55] }, airTemperatureF: { good: [65, 90], warn: [55, 100] } } },
  herb: { label: 'Herbs', emoji: '🌱', ranges: { soilMoisturePercent: { good: [40, 70], warn: [30, 80] }, airHumidity: { good: [40, 65], warn: [30, 75] }, airTemperatureF: { good: [65, 82], warn: [55, 90] } } },
  vegetable: { label: 'Vegetables', emoji: '🥬', ranges: { soilMoisturePercent: { good: [45, 75], warn: [35, 85] }, airHumidity: { good: [50, 75], warn: [40, 85] }, airTemperatureF: { good: [60, 85], warn: [50, 92] } } },
  fruit: { label: 'Fruits & berries', emoji: '🍓', ranges: { soilMoisturePercent: { good: [45, 75], warn: [35, 85] }, airHumidity: { good: [45, 70], warn: [35, 80] }, airTemperatureF: { good: [60, 85], warn: [45, 92] } } },
  flower: { label: 'Flowers', emoji: '🌸', ranges: { soilMoisturePercent: { good: [40, 70], warn: [30, 80] }, airHumidity: { good: [40, 70], warn: [30, 80] }, airTemperatureF: { good: [60, 82], warn: [50, 90] } } },
  orchid: { label: 'Orchids', emoji: '🌺', ranges: { soilMoisturePercent: { good: [40, 65], warn: [30, 75] }, airHumidity: { good: [55, 80], warn: [45, 90] }, airTemperatureF: { good: [65, 82], warn: [58, 90] } } },
  shrub: { label: 'Trees & shrubs', emoji: '🌳', ranges: { soilMoisturePercent: { good: [35, 65], warn: [25, 78] }, airHumidity: { good: [35, 70], warn: [25, 82] }, airTemperatureF: { good: [50, 88], warn: [35, 95] } } },
  lawn: { label: 'Lawn & grass', emoji: '🌾', ranges: { soilMoisturePercent: { good: [40, 70], warn: [30, 82] }, airHumidity: { good: [35, 75], warn: [25, 85] }, airTemperatureF: { good: [55, 88], warn: [45, 95] } } },
};

// [common name, scientific name, category, optional emoji, optional range override]
const SPECIES = [
  // Houseplants
  ['Pothos', 'Epipremnum aureum', 'houseplant'],
  ['Snake plant', 'Sansevieria trifasciata', 'houseplant'],
  ['Spider plant', 'Chlorophytum comosum', 'houseplant'],
  ['ZZ plant', 'Zamioculcas zamiifolia', 'houseplant'],
  ['Peace lily', 'Spathiphyllum wallisii', 'houseplant'],
  ['Heartleaf philodendron', 'Philodendron hederaceum', 'houseplant'],
  ['Monstera', 'Monstera deliciosa', 'houseplant'],
  ['Rubber plant', 'Ficus elastica', 'houseplant'],
  ['Chinese evergreen', 'Aglaonema commutatum', 'houseplant'],
  ['Dracaena', 'Dracaena marginata', 'houseplant'],
  ['Cast iron plant', 'Aspidistra elatior', 'houseplant'],
  ['Dumb cane', 'Dieffenbachia seguine', 'houseplant'],
  ['English ivy', 'Hedera helix', 'houseplant'],
  ['Parlor palm', 'Chamaedorea elegans', 'houseplant'],
  ['Fiddle leaf fig', 'Ficus lyrata', 'houseplant'],

  // Tropical & ferns
  ['Boston fern', 'Nephrolepis exaltata', 'tropical'],
  ['Calathea', 'Calathea orbifolia', 'tropical'],
  ['Maidenhair fern', 'Adiantum raddianum', 'tropical'],
  ["Bird's nest fern", 'Asplenium nidus', 'tropical'],
  ['Prayer plant', 'Maranta leuconeura', 'tropical'],
  ['Anthurium', 'Anthurium andraeanum', 'tropical'],
  ['Croton', 'Codiaeum variegatum', 'tropical'],
  ['Nerve plant', 'Fittonia albivenis', 'tropical'],
  ['Bromeliad', 'Guzmania lingulata', 'tropical'],
  ['Banana plant', 'Musa acuminata', 'tropical', '🍌'],
  ['Elephant ear', 'Colocasia esculenta', 'tropical'],
  ['Bird of paradise', 'Strelitzia reginae', 'tropical'],

  // Succulents & cacti
  ['Aloe vera', 'Aloe barbadensis', 'succulent'],
  ['Jade plant', 'Crassula ovata', 'succulent'],
  ['Echeveria', 'Echeveria elegans', 'succulent'],
  ['Haworthia', 'Haworthia fasciata', 'succulent'],
  ['Barrel cactus', 'Ferocactus wislizeni', 'succulent', '🌵'],
  ['Prickly pear', 'Opuntia ficus-indica', 'succulent', '🌵'],
  ['Christmas cactus', 'Schlumbergera bridgesii', 'succulent'],
  ["Burro's tail", 'Sedum morganianum', 'succulent'],
  ['Agave', 'Agave americana', 'succulent'],
  ['String of pearls', 'Senecio rowleyanus', 'succulent'],
  ['Zebra plant', 'Haworthiopsis attenuata', 'succulent'],
  ['Panda plant', 'Kalanchoe tomentosa', 'succulent'],

  // Herbs
  ['Basil', 'Ocimum basilicum', 'herb'],
  ['Mint', 'Mentha spicata', 'herb'],
  ['Rosemary', 'Salvia rosmarinus', 'herb'],
  ['Thyme', 'Thymus vulgaris', 'herb'],
  ['Cilantro', 'Coriandrum sativum', 'herb'],
  ['Parsley', 'Petroselinum crispum', 'herb'],
  ['Oregano', 'Origanum vulgare', 'herb'],
  ['Sage', 'Salvia officinalis', 'herb'],
  ['Chives', 'Allium schoenoprasum', 'herb'],
  ['Dill', 'Anethum graveolens', 'herb'],
  ['Lavender', 'Lavandula angustifolia', 'herb'],
  ['Lemongrass', 'Cymbopogon citratus', 'herb'],

  // Vegetables
  ['Tomato', 'Solanum lycopersicum', 'vegetable', '🍅'],
  ['Pepper', 'Capsicum annuum', 'vegetable', '🌶️'],
  ['Lettuce', 'Lactuca sativa', 'vegetable', '🥬'],
  ['Cucumber', 'Cucumis sativus', 'vegetable', '🥒'],
  ['Carrot', 'Daucus carota', 'vegetable', '🥕'],
  ['Spinach', 'Spinacia oleracea', 'vegetable'],
  ['Kale', 'Brassica oleracea acephala', 'vegetable'],
  ['Broccoli', 'Brassica oleracea italica', 'vegetable', '🥦'],
  ['Zucchini', 'Cucurbita pepo', 'vegetable'],
  ['Green bean', 'Phaseolus vulgaris', 'vegetable'],
  ['Onion', 'Allium cepa', 'vegetable', '🧅'],
  ['Potato', 'Solanum tuberosum', 'vegetable', '🥔'],
  ['Eggplant', 'Solanum melongena', 'vegetable', '🍆'],
  ['Radish', 'Raphanus sativus', 'vegetable'],

  // Fruits & berries
  ['Strawberry', 'Fragaria ananassa', 'fruit', '🍓'],
  ['Blueberry', 'Vaccinium corymbosum', 'fruit', '🫐'],
  ['Raspberry', 'Rubus idaeus', 'fruit'],
  ['Lemon tree', 'Citrus limon', 'fruit', '🍋'],
  ['Lime tree', 'Citrus aurantiifolia', 'fruit'],
  ['Orange tree', 'Citrus sinensis', 'fruit', '🍊'],
  ['Fig tree', 'Ficus carica', 'fruit'],
  ['Grape vine', 'Vitis vinifera', 'fruit', '🍇'],
  ['Watermelon', 'Citrullus lanatus', 'fruit', '🍉'],
  ['Cantaloupe', 'Cucumis melo', 'fruit', '🍈'],
  ['Avocado', 'Persea americana', 'fruit', '🥑'],

  // Flowers
  ['Rose', 'Rosa hybrid', 'flower', '🌹'],
  ['Sunflower', 'Helianthus annuus', 'flower', '🌻'],
  ['Tulip', 'Tulipa gesneriana', 'flower', '🌷'],
  ['Marigold', 'Tagetes erecta', 'flower'],
  ['Petunia', 'Petunia atkinsiana', 'flower'],
  ['Geranium', 'Pelargonium hortorum', 'flower'],
  ['Hydrangea', 'Hydrangea macrophylla', 'flower'],
  ['Daisy', 'Bellis perennis', 'flower', '🌼'],
  ['Begonia', 'Begonia semperflorens', 'flower'],
  ['Chrysanthemum', 'Chrysanthemum morifolium', 'flower'],
  ['Dahlia', 'Dahlia pinnata', 'flower'],
  ['Lily', 'Lilium candidum', 'flower'],
  ['Hibiscus', 'Hibiscus rosa-sinensis', 'flower', '🌺'],

  // Orchids
  ['Moth orchid', 'Phalaenopsis amabilis', 'orchid'],
  ['Dendrobium orchid', 'Dendrobium nobile', 'orchid'],
  ['Cattleya orchid', 'Cattleya labiata', 'orchid'],
  ['Oncidium orchid', 'Oncidium altissimum', 'orchid'],
  ['Cymbidium orchid', 'Cymbidium hookerianum', 'orchid'],
  ['Vanda orchid', 'Vanda coerulea', 'orchid'],

  // Trees & shrubs
  ['Boxwood', 'Buxus sempervirens', 'shrub'],
  ['Azalea', 'Rhododendron simsii', 'shrub'],
  ['Holly', 'Ilex aquifolium', 'shrub'],
  ['Juniper', 'Juniperus communis', 'shrub'],
  ['Japanese maple', 'Acer palmatum', 'shrub', '🍁'],
  ['Lilac', 'Syringa vulgaris', 'shrub'],
  ['Camellia', 'Camellia japonica', 'shrub'],
  ['Gardenia', 'Gardenia jasminoides', 'shrub'],
  ['Bougainvillea', 'Bougainvillea glabra', 'shrub'],
  ['Hibiscus shrub', 'Hibiscus syriacus', 'shrub'],

  // Lawn & grass
  ['Bermuda grass', 'Cynodon dactylon', 'lawn'],
  ['Kentucky bluegrass', 'Poa pratensis', 'lawn'],
  ['St. Augustine grass', 'Stenotaphrum secundatum', 'lawn'],
  ['Zoysia grass', 'Zoysia japonica', 'lawn'],
  ['Tall fescue', 'Festuca arundinacea', 'lawn'],
  ['Perennial ryegrass', 'Lolium perenne', 'lawn'],
  ['White clover', 'Trifolium repens', 'lawn', '🍀'],
];

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const GENERIC = {
  id: 'generic',
  name: 'Generic plant',
  scientific: 'Any plant',
  category: 'houseplant',
  emoji: '🌿',
  ranges: PLANT_CATEGORIES.houseplant.ranges,
};

export const PLANT_LIST = [
  GENERIC,
  ...SPECIES.map(([name, scientific, cat, emoji, override]) => {
    const c = PLANT_CATEGORIES[cat];
    return {
      id: slug(name),
      name,
      scientific,
      category: cat,
      emoji: emoji || c.emoji,
      ranges: { ...c.ranges, ...(override || {}) },
    };
  }),
];

export const PLANTS = Object.fromEntries(PLANT_LIST.map((p) => [p.id, p]));
