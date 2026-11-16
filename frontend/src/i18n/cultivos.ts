// Nombres de los 42 cultivos del motor (ids de backend/data/crop_requirements.csv).
// La API solo trae el nombre en español (name_es); en inglés se usa esta tabla.
export const CULTIVOS_EN: Record<string, string> = {
  papa: 'Potato', arveja: 'Pea', haba: 'Faba bean', frijol: 'Common bean', chocho: 'Andean lupin (tarwi)',
  trebol: 'Red clover', alfalfa: 'Alfalfa', raigras: 'Ryegrass', avena: 'Oats', cebada: 'Barley', trigo: 'Wheat',
  maiz: 'Maize', quinua: 'Quinoa', oca: 'Oca', ulluco: 'Ulluco', mashua: 'Mashua', arracacha: 'Arracacha',
  cebolla: 'Onion', zanahoria: 'Carrot', arroz: 'Rice', sorgo: 'Sorghum', mijo_perla: 'Pearl millet', centeno: 'Rye',
  soya: 'Soybean', mani: 'Peanut', garbanzo: 'Chickpea', lenteja: 'Lentil', caupi: 'Cowpea', camote: 'Sweet potato',
  yuca: 'Cassava', name: 'Yam', girasol: 'Sunflower', colza: 'Rapeseed (canola)', ajonjoli: 'Sesame', tomate: 'Tomato',
  repollo: 'Cabbage', amaranto: 'Amaranth', cana: 'Sugarcane', algodon: 'Cotton', cafe: 'Coffee', veza: 'Vetch',
  remolacha: 'Beet',
}

/** Nombre para mostrar de un cultivo según el idioma activo (con mayúscula inicial). */
export function nombreCultivo(id: string, nombreEs: string | undefined, lang: string | undefined) {
  const s = (lang?.startsWith('es') ? undefined : CULTIVOS_EN[id]) ?? nombreEs ?? id
  return s ? s[0].toLocaleUpperCase() + s.slice(1) : s
}
