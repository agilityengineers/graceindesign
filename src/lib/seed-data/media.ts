/**
 * Image slot manifest. Every photo slot the designs use is listed here with the stock
 * placeholder the prototypes referenced (remote), the subject to generate with Magnific,
 * and the aspect ratio. `brand` entries are real assets from design/assets.
 * scripts/fetch-media.ts downloads generated/stock files into public/media/<slot>.<ext>.
 */
export type MediaSlot = { slot: string; subject: string; aspect: "16:9" | "4:3" | "3:2" | "1:1" | "2:3"; remote?: string; brand?: string; usedOn: string[]; magnificId?: string };
const I = "https://img.magnific.com/free-photo/";

export const MEDIA_SLOTS: MediaSlot[] = [
  // Brand assets (real)
  { slot: "brand.logo-dark", subject: "Logo (dark wordmark)", aspect: "16:9", brand: "/assets/logo-dark-transparent.png", usedOn: ["Nav"] },
  { slot: "brand.logo-white", subject: "Logo (white on dark)", aspect: "16:9", brand: "/assets/logo-white-on-dark.png", usedOn: ["Footer", "Admin"] },
  { slot: "brand.gid-circle", subject: "GID circle mark", aspect: "1:1", brand: "/assets/gid-circle.png", usedOn: ["Admin", "Roadmap"] },
  { slot: "brand.gid-square", subject: "GID square mark (navy)", aspect: "1:1", brand: "/assets/gid-square-navy.png", usedOn: ["Favicon"] },
  { slot: "brand.grace-bw", subject: "Grace A. Williams headshot (B&W)", aspect: "2:3", brand: "/assets/grace-headshot-bw.jpg", usedOn: ["About", "Home", "Admin"] },
  { slot: "brand.grace", subject: "Grace A. Williams headshot (color)", aspect: "2:3", brand: "/assets/grace-headshot.jpg", usedOn: ["Media library"] },
  { slot: "brand.couple-autumn", subject: "Older couple in autumn", aspect: "3:2", brand: "/assets/couple-autumn.jpg", usedOn: ["Home", "Aging-in-Place", "HHR"] },
  { slot: "brand.couple-sunset", subject: "Older couple at sunset", aspect: "3:2", brand: "/assets/couple-sunset.jpg", usedOn: ["Home hero", "Home Health Series"] },
  { slot: "brand.couple-hammock", subject: "Older couple in a hammock", aspect: "3:2", brand: "/assets/couple-hammock.jpg", usedOn: ["HHR", "AIP Partners"] },
  { slot: "brand.aip-consult", subject: "Aging-in-place consultation", aspect: "4:3", brand: "/assets/aip-consult-1.png", usedOn: ["Aging-in-Place", "Virtual Assessment"] },
  { slot: "brand.aip-planning", subject: "Aging-in-place planning session", aspect: "4:3", brand: "/assets/aip-planning-1.png", usedOn: ["AIP Partners", "Home"] },
  { slot: "brand.aip-overview", subject: "Aging-in-place overview", aspect: "4:3", brand: "/assets/aip-overview.jpg", usedOn: ["Media library"] },
  { slot: "brand.com-meeting", subject: "Commercial client meeting", aspect: "4:3", brand: "/assets/com-meeting-1.png", usedOn: ["Commercial", "Home"] },
  { slot: "brand.pm-site-1", subject: "Project management on site", aspect: "4:3", brand: "/assets/pm-site-1.png", usedOn: ["Project Management", "Home"] },
  { slot: "brand.pm-site-2", subject: "Project management on site (2)", aspect: "4:3", brand: "/assets/pm-site-2.png", usedOn: ["Project Management"] },
  { slot: "brand.studio-team", subject: "Grace In Design studio team", aspect: "4:3", brand: "/assets/studio-team.png", usedOn: ["About", "AIP Partners"] },

  // Interiors — residential
  { slot: "int.kitchen-windows", subject: "Bright modern residential kitchen with large windows, white cabinets, oak floors, marble island, morning light, no people", aspect: "16:9", remote: I + "interior-shot-modern-house-kitchen-with-large-windows_181624-24368.jpg", usedOn: ["Home hero", "Services hero", "Residential scene"], magnificId: "aFOLYrZfSh" },
  { slot: "int.bright-apartment", subject: "Contemporary apartment living room with natural light from a large window, sheer white curtains, warm neutral furniture", aspect: "4:3", remote: I + "beautiful-contemporary-modern-design-apartment-with-natural-light-fron-bir-window-white-curtain_609648-50.jpg", usedOn: ["Home services grid", "Residential hero"], magnificId: "cpqv9Jf0eP" },
  { slot: "int.summer-living", subject: "Beautiful summer modern home interior living room, layered textiles, plants, soft daylight", aspect: "16:9", remote: I + "beautiful-summer-modern-home-interior-design_181624-60483.jpg", usedOn: ["Residential", "Design Refresh"], magnificId: "3zhegLZREY" },
  { slot: "int.cozy-bedroom", subject: "Cozy modern bedroom with comfortable layered bedding, warm lamps, calm palette", aspect: "16:9", remote: I + "cozy-bedroom-with-comfortable-furniture-modern-apartment_181624-58069.jpg", usedOn: ["Residential scene", "Model Home scene"], magnificId: "ksA4hIT16B" },
  { slot: "int.bedroom-orchid", subject: "Serene bedroom with pendant lamp and orchid, linen bedding, soft morning light", aspect: "16:9", remote: I + "cozy-bedroom-with-pendant-lamp-orchid-home-comfort_169016-70987.jpg", usedOn: ["Design Refresh scene"], magnificId: "ksA4vpA16B" },
  { slot: "int.small-bath", subject: "Small bright bathroom with a window, white tile, modern fixtures, no people", aspect: "4:3", remote: I + "small-bathroom-with-window-apartment_181624-19696.jpg", usedOn: ["Residential scene", "Aging-in-Place before", "WELLness"], magnificId: "u59SdpNQLD" },
  { slot: "int.contemporary-living", subject: "Contemporary living room with sofa, art and plants, editorial interior photography", aspect: "3:2", remote: I + "contemporary-living-room_1150-12613.jpg", usedOn: ["General service", "News", "Home Health Series"], magnificId: "dtjHGylXSL" },
  { slot: "int.plants-deco", subject: "Modern living room styled with plants and decor, fresh and bright, design refresh", aspect: "16:9", remote: I + "beautiful-modern-plants-deco_23-2149198562.jpg", usedOn: ["Home hero refresh", "Design Refresh", "WELLness"], magnificId: "jUYiCItLD0" },
  { slot: "int.minimal-green-art", subject: "Minimalist interior with a green plant and framed art on a neutral wall, calm", aspect: "16:9", remote: I + "minimalist-interior-with-green-plant-art-frames_9975-133014.jpg", usedOn: ["Design Refresh", "HHR scene", "WELLness"], magnificId: "hu7xV2jvqL" },
  { slot: "int.mirror-plant", subject: "Interior decor vignette with a round mirror and potted plant on a console", aspect: "1:1", remote: I + "interior-decor-with-mirror-potted-plant_23-2149428026.jpg", usedOn: ["Products"], magnificId: "s7cRQtFl8e" },
  { slot: "int.armchair-window", subject: "Reading armchair beside a sunny window with warm layered lighting, aging-friendly", aspect: "4:3", remote: I + "armchair-near-window_1203-138.jpg", usedOn: ["HHR scene", "WELLness", "Home Health Series", "Products"], magnificId: "rgzNfoDxtc" },
  { slot: "int.relax-sofa-window", subject: "Relaxed sofa by a window with soft evening light, night-path lighting visible", aspect: "4:3", remote: I + "relax-sofa-window_1150-12924.jpg", usedOn: ["WELLness", "Home Health Series"], magnificId: "YMFm4UhWeC" },
  { slot: "int.living-zoom", subject: "Living room interior design with good light and air, plants, set up for video calls", aspect: "3:2", remote: I + "living-room-interior-design-zoom-calls_23-2149684494.jpg", usedOn: ["News", "Home"], magnificId: "s7cRQhql8e" },
  { slot: "int.zoom-plants", subject: "Interior with abundant houseplants and clean air feeling, bright and modern", aspect: "16:9", remote: I + "interior-design-zoom-calls-with-plants_23-2149684489.jpg", usedOn: ["HHR scene", "WELLness"], magnificId: "hu7xVngvqL" },
  { slot: "int.lobby-bookshelf", subject: "Cozy home entry foyer with bookshelf, zero-step entrance, clear walkway, warm light", aspect: "3:2", remote: I + "cozy-lobby-with-bookshelf_1262-3517.jpg", usedOn: ["News featured", "Aging-in-Place entry", "WELLness", "Home Health Series", "Products"], magnificId: "LwW3QCdswO" },
  { slot: "int.dining-room", subject: "Modern private house interior with a big dining room, scaled furniture, model home styling", aspect: "16:9", remote: I + "interior-with-bid-dining-room-modern-private-house_181624-17504.jpg", usedOn: ["Model Home"], magnificId: "u59SBdNQLD" },
  { slot: "int.model-living-fireplace", subject: "High-angle view of a minimalist furnished living room with fireplace, model home merchandising", aspect: "16:9", remote: I + "high-angle-minimalist-living-room-with-fireplace_23-2148238570.jpg", usedOn: ["Home services grid", "Model Home", "News"], magnificId: "1lG9fawr4r" },
  { slot: "ext.house-sold", subject: "New-build model home exterior with a SOLD yard sign on opening weekend, bright day", aspect: "16:9", remote: I + "house-with-sold-yard-sign_23-2149383622.jpg", usedOn: ["Model Home scene"], magnificId: "gOT2qHKSXO" },

  // Accessible / aging-in-place
  { slot: "aip.shower-grab-bar", subject: "Beautiful accessible walk-in shower with stylish grab bar, slip-resistant tile, bench, spa-like, no people", aspect: "16:9", remote: I + "shower-with-handle_1203-481.jpg", usedOn: ["Aging-in-Place scene", "Services hero", "HHR card", "WELLness", "Products"], magnificId: "fHysD0xCDY" },
  { slot: "aip.kitchen-wheelchair", subject: "Senior woman in a wheelchair at an accessible kitchen with lowered counters and reachable storage, warm daylight, dignified", aspect: "4:3", remote: I + "disabled-senior-woman-sitting-wheelchair-kitchen-looking-through-window-living-with-handicapped-person-husband-helping-wife-with-disability-elderly-couple-with-happy-marriage_482257-10721.jpg", usedOn: ["WELLness", "Home Health Series", "Products"], magnificId: "jUYiuuELD0" },
  { slot: "aip.senior-laptop-call", subject: "Senior woman at home on a laptop video call, smiling, bright living room, virtual home assessment", aspect: "16:9", remote: I + "senior-woman-using-laptop-video-call_23-2149076812.jpg", usedOn: ["Virtual Assessment"], magnificId: "YMFm9NFWeC" },
  { slot: "aip.senior-couple", subject: "Adorable senior couple together at home, front view, warm and happy", aspect: "3:2", remote: I + "front-view-adorable-senior-couple-together_23-2148268640.jpg", usedOn: ["AIP Partners scene", "News", "Products"], magnificId: "u59SB8RQLD" },
  { slot: "aip.walker-closeup", subject: "Close-up of a modern rollator walker in a bright hallway, product-style photo", aspect: "1:1", remote: I + "closeup-walker_53876-20434.jpg", usedOn: ["Products"], magnificId: "3zheUJYREY" },

  // Commercial
  { slot: "com.open-office", subject: "Corner of an open-plan office with modern interior design, natural light, accessible layout, no people", aspect: "16:9", remote: I + "corner-open-office-space-with-modern-interior-design_181624-17688.jpg", usedOn: ["Home hero", "Services hero", "Commercial"], magnificId: "rgzNaBHxtc" },
  { slot: "com.lounge-office", subject: "Modern lounge area inside an office building, warm wood and soft seating", aspect: "16:9", remote: I + "modern-lounge-room-interior-office-building_1262-12374.jpg", usedOn: ["Home classic hero", "General service", "Commercial scene"], magnificId: "ksA4hBW16B" },
  { slot: "com.hotel-lobby", subject: "Modern hotel lobby with leather sofa, chairs, lamp and round tables, brand-forward reception", aspect: "16:9", remote: I + "modern-hotel-lobby-with-leather-sofa-chairs-lamp-round-tables_1262-12373.jpg", usedOn: ["Commercial scene", "News"], magnificId: "iGmpwXm3uK" },
  { slot: "com.modern-office", subject: "View of a finished modern office interior, clean and bright, after renovation", aspect: "16:9", remote: I + "view-modern-office_1170-1969.jpg", usedOn: ["Project Management after", "News"], magnificId: "u59S87fQLD" },

  // Before / after pairs
  { slot: "ba.empty-kitchen", subject: "Empty dated kitchen before renovation, bare counters, flat light, realistic", aspect: "16:9", remote: I + "view-empty-kitchen_1170-2792.jpg", usedOn: ["Residential before"], magnificId: "3zhe7oqREY" },
  { slot: "ba.kitchen-after", subject: "The same kitchen after a full renovation: new cabinets, island, pendant lights, styled", aspect: "16:9", remote: I + "beautiful-shot-modern-house-kitchen_181624-4007.jpg", usedOn: ["Residential after"], magnificId: "jUYiFARLD0" },
  { slot: "ba.corporate-empty", subject: "Empty corporate shell space before fit-out, concrete floor, exposed ceiling", aspect: "16:9", remote: I + "corporate-building-with-empty-room_23-2148727503.jpg", usedOn: ["Commercial before"], magnificId: "LwW3HzOswO" },
  { slot: "ba.empty-luxury-room", subject: "Empty modern luxury living room before staging, bare floors and walls, large windows", aspect: "16:9", remote: I + "empty-modern-luxury-room-interior-design_53876-129811.jpg", usedOn: ["Model Home before", "Design Refresh before"], magnificId: "s7cRqYwl8e" },
  { slot: "ba.architect-office", subject: "Empty architectural office with a building model, blueprints and plans on a table, nobody", aspect: "16:9", remote: I + "empty-architectural-office-with-building-model-blueprints-plans-table-nobody-space-used-real-estate-design-development-with-architecture-construction-structure_482257-27835.jpg", usedOn: ["Project Management before"], magnificId: "CqPlByzEEy" },

  // Caribbean Connection
  { slot: "cc.family-dinner", subject: "Jamaican multigenerational family taking a selfie together at a home dinner table, joyful, warm evening light", aspect: "16:9", remote: I + "portrait-african-american-multigenerational-family-taking-selfie-together-while-having-dinner-home_58466-14791.jpg", usedOn: ["Caribbean hero", "Caribbean blog"], magnificId: "3zhe7h1REY" },
  { slot: "cc.senior-couple-hug", subject: "Caribbean senior couple hugging on a verandah, side view, affectionate, tropical light", aspect: "16:9", remote: I + "side-view-hugging-senior-couple_23-2148656157.jpg", usedOn: ["Caribbean newsletter", "Caribbean regional"], magnificId: "1lG9ufSr4r" },
  { slot: "cc.seniors-walking", subject: "Group of Caribbean senior people walking together outdoors in a Jamaican town, community feel", aspect: "16:9", remote: I + "medium-shot-senior-people-walking-together_23-2149365826.jpg", usedOn: ["Caribbean directory"], magnificId: "fHysBdLCDY" },
  { slot: "cc.seniors-beach", subject: "Older Caribbean adults spending time together on a Jamaican beach, relaxed and happy", aspect: "16:9", remote: I + "older-people-beach-spending-time-together_23-2149014637.jpg", usedOn: ["Caribbean events"], magnificId: "gOT2KK6SXO" },
  { slot: "cc.verandah-sea", subject: "Jamaican home verandah with a chair overlooking the sea, cross-ventilation, cool and bright, aging-friendly", aspect: "3:2", remote: I + "patio-balcony-with-chair-around-sea-ocean-view_74190-6863.jpg", usedOn: ["Caribbean post"], magnificId: "0ebaZ2uTfW" },
  { slot: "cc.elderly-woman-portrait", subject: "Portrait of an elderly Jamaican woman outside her home, dignified, hurricane-ready home in background", aspect: "3:2", remote: I + "medium-shot-elderly-woman-exterior-portrait_23-2149352028.jpg", usedOn: ["Caribbean post"], magnificId: "hu7xeXPvqL" },
];

export const slotMap = Object.fromEntries(MEDIA_SLOTS.map((m) => [m.slot, m]));
export const mediaRef = (slot: string) => `media://${slot}`;
