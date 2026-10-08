export const categories = [
  "Hair Services",
  "Hair Color & Styling",
  "Hair Treatments",
  "Nail Services",
  "Spa & Relaxation",
];
export const services = [
  {
    id: "ladies",
    name: "Ladies Haircut",
    price: 120,
    duration: 60,
    category: categories[0],
    description: "A fresh cut, shaped to suit you.",
    addon: true,
  },
  {
    id: "mens",
    name: "Men’s Haircut",
    price: 120,
    duration: 60,
    category: categories[0],
    description: "A clean cut with a considered finish.",
    addon: true,
  },
  {
    id: "kids",
    name: "Kid’s Haircut",
    price: 150,
    duration: 60,
    category: categories[0],
    description: "A little refresh for your little one.",
    addon: true,
  },
  {
    id: "style",
    name: "Haircut & Style",
    price: 350,
    duration: 60,
    category: categories[0],
    description: "Your new look, cut and styled to perfection.",
    icon: "scissors",
    featured: true,
  },
  {
    id: "color",
    name: "Hair Coloring",
    price: 1200,
    duration: 120,
    category: categories[1],
    description: "Rich, dimensional color with a beautiful finish.",
    icon: "palette",
    featured: true,
  },
  {
    id: "treatment",
    name: "Hair Treatment",
    price: 800,
    duration: 60,
    category: categories[2],
    description: "Restore softness, shine, and a little self-love.",
    icon: "sparkles",
    featured: true,
  },
  {
    id: "manicure",
    name: "Manicure",
    price: 250,
    duration: 45,
    category: categories[3],
    description: "Beautifully shaped nails and a polished finish.",
    icon: "hand",
    featured: true,
  },
];
export const professionals = [
  { id: "any", name: "Any Professional", role: "Maximum availability" },
  {
    id: "leo",
    name: "Leo Andrei Once",
    role: "Hairdresser",
    image: "/images/leo.jpg",
  },
  {
    id: "billy",
    name: "Billy Conception",
    role: "Hairdresser",
    image: "/images/billy.jpg",
  },
  {
    id: "ray",
    name: "Ray Lance Gregorio",
    role: "Hairdresser",
    image: "/images/ray.jpg",
  },
];
export const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
export const durationLabel = (minutes) =>
  minutes === 60
    ? "1 hour"
    : minutes >= 120
      ? `${minutes / 60} hours`
      : `${minutes} min`;
