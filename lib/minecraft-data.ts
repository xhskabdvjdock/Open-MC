// Small curated Minecraft data for the command generator.
// IDs are real vanilla IDs; kept centralized so version updates are easy.
export const VANILLA_ITEMS = [
  "minecraft:diamond_sword", "minecraft:netherite_sword", "minecraft:bow", "minecraft:crossbow",
  "minecraft:diamond_pickaxe", "minecraft:netherite_pickaxe", "minecraft:diamond_axe",
  "minecraft:shield", "minecraft:elytra", "minecraft:totem_of_undying",
  "minecraft:diamond", "minecraft:netherite_ingot", "minecraft:iron_ingot", "minecraft:gold_ingot",
  "minecraft:oak_planks", "minecraft:stone", "minecraft:cobblestone", "minecraft:torch",
  "minecraft:ender_pearl", "minecraft:ender_eye", "minecraft:golden_apple", "minecraft:enchanted_golden_apple",
  "minecraft:arrow", "minecraft:spectral_arrow", "minecraft:firework_rocket", "minecraft:bookshelf",
  "minecraft:enchanting_table", "minecraft:anvil", "minecraft:beacon", "minecraft:shulker_box",
  "minecraft:diamond_chestplate", "minecraft:diamond_helmet", "minecraft:diamond_leggings", "minecraft:diamond_boots",
  "minecraft:cooked_beef", "minecraft:bread", "minecraft:potion", "minecraft:splash_potion",
].sort();

export const VANILLA_ENTITIES = [
  "minecraft:zombie", "minecraft:skeleton", "minecraft:creeper", "minecraft:enderman",
  "minecraft:spider", "minecraft:pig", "minecraft:cow", "minecraft:sheep", "minecraft:chicken",
  "minecraft:villager", "minecraft:iron_golem", "minecraft:wolf", "minecraft:cat", "minecraft:horse",
  "minecraft:warden", "minecraft:allay", "minecraft:camel", "minecraft:sniffer",
  "minecraft:armor_stand", "minecraft:item_frame", "minecraft:boat", "minecraft:minecart",
  "minecraft:lightning_bolt", "minecraft:fireball", "minecraft:tnt", "minecraft:ender_dragon", "minecraft:wither",
].sort();

export const VANILLA_EFFECTS = [
  "minecraft:speed", "minecraft:slowness", "minecraft:haste", "minecraft:mining_fatigue",
  "minecraft:strength", "minecraft:instant_health", "minecraft:instant_damage", "minecraft:jump_boost",
  "minecraft:nausea", "minecraft:regeneration", "minecraft:resistance", "minecraft:fire_resistance",
  "minecraft:water_breathing", "minecraft:invisibility", "minecraft:blindness", "minecraft:night_vision",
  "minecraft:hunger", "minecraft:weakness", "minecraft:poison", "minecraft:wither",
  "minecraft:health_boost", "minecraft:absorption", "minecraft:saturation", "minecraft:glowing",
  "minecraft:levitation", "minecraft:luck", "minecraft:unluck", "minecraft:slow_falling", "minecraft:conduit_power",
  "minecraft:dolphins_grace", "minecraft:bad_omen", "minecraft:hero_of_the_village", "minecraft:darkness",
].sort();

export const VANILLA_ENCHANTMENTS = [
  { id: "minecraft:sharpness", max: 5 },
  { id: "minecraft:smite", max: 5 },
  { id: "minecraft:bane_of_arthropods", max: 5 },
  { id: "minecraft:unbreaking", max: 3 },
  { id: "minecraft:mending", max: 1 },
  { id: "minecraft:protection", max: 4 },
  { id: "minecraft:fire_protection", max: 4 },
  { id: "minecraft:feather_falling", max: 4 },
  { id: "minecraft:efficiency", max: 5 },
  { id: "minecraft:silk_touch", max: 1 },
  { id: "minecraft:fortune", max: 3 },
  { id: "minecraft:power", max: 5 },
  { id: "minecraft:infinity", max: 1 },
  { id: "minecraft:flame", max: 1 },
  { id: "minecraft:loyalty", max: 3 },
  { id: "minecraft:riptide", max: 3 },
  { id: "minecraft:swift_sneak", max: 3 },
].sort((a, b) => a.id.localeCompare(b.id));

export const GAMEMODES = ["survival", "creative", "adventure", "spectator"];
export const WEATHERS = ["clear", "rain", "thunder"];
export const TIMES = [
  { label: "Day (1000)", value: "1000" },
  { label: "Noon (6000)", value: "6000" },
  { label: "Night (13000)", value: "13000" },
  { label: "Midnight (18000)", value: "18000" },
];
