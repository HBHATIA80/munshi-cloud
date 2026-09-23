export type TplCat = { name: string; emoji: string; subs: string[] };
export type Tpl = { label: string; cats: TplCat[]; brands: string[] };

export const TRADE_TEMPLATES: Record<string, Tpl> = {
  mobile: {
    label: "Mobile parts & accessories",
    cats: [
      { name: "Spare Parts", emoji: "🔧", subs: ["Screens", "Batteries", "Charging Ports", "Cameras", "Flex Cables", "Motherboards"] },
      { name: "Accessories", emoji: "🎧", subs: ["Covers & Glass", "Cables & Chargers", "Audio", "Power Banks", "Holders & Mounts"] },
      { name: "Repair Tools", emoji: "🛠️", subs: ["Toolkits", "Adhesives", "Machines", "Consumables"] },
    ],
    brands: ["Apple", "Samsung", "Xiaomi / Redmi", "Realme", "Oppo", "Vivo", "OnePlus", "Motorola", "BoAt", "Generic"],
  },
  grocery: {
    label: "Grocery & kirana",
    cats: [
      { name: "Staples", emoji: "🌾", subs: ["Rice & Dal", "Atta & Flour", "Oil & Ghee", "Spices & Masala", "Sugar & Salt"] },
      { name: "Packaged Foods", emoji: "📦", subs: ["Biscuits & Snacks", "Beverages", "Dairy", "Instant Foods"] },
      { name: "Household", emoji: "🧴", subs: ["Cleaning", "Personal Care", "Pooja Needs"] },
    ],
    brands: ["Tata", "Fortune", "Aashirvaad", "Amul", "Britannia", "Parle", "Nestlé", "HUL", "Dabur", "Local"],
  },
  electronics: {
    label: "Electronics & computer",
    cats: [
      { name: "Components", emoji: "🔌", subs: ["Cables & Adapters", "Storage", "Peripherals", "Power"] },
      { name: "Devices", emoji: "💻", subs: ["Laptops", "Monitors", "Printers", "Networking"] },
      { name: "Services", emoji: "🧰", subs: ["Repairs", "Installations"] },
    ],
    brands: ["HP", "Dell", "Lenovo", "Asus", "Logitech", "Seagate", "TP-Link", "Generic"],
  },
  clothing: {
    label: "Clothing & fashion",
    cats: [
      { name: "Men", emoji: "👔", subs: ["Shirts", "Trousers", "Ethnic", "Innerwear"] },
      { name: "Women", emoji: "👗", subs: ["Kurtis", "Sarees", "Tops", "Ethnic"] },
      { name: "Kids", emoji: "🧒", subs: ["Boys", "Girls", "Infants"] },
    ],
    brands: ["Local Brand", "Raymond", "Allen Solly", "Biba", "Libas", "Jockey"],
  },
  generic: {
    label: "General / other trade",
    cats: [
      { name: "Products", emoji: "📦", subs: ["Type A", "Type B"] },
      { name: "Services", emoji: "🧰", subs: [] },
    ],
    brands: [],
  },
};