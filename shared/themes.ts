/** Stable IDs are persisted in backups; never use display names as settings keys. */
export const themeIds = ['enchanted-forest', 'midnight-observatory', 'amber-hearth'] as const;
export type ThemeId = typeof themeIds[number];
export const themes: ReadonlyArray<{id:ThemeId;name:string;description:string;eyebrow:string;premium:boolean}> = [
 {id:'enchanted-forest',name:'Enchanted Forest',description:'Emerald glass, quiet woodland, and warm lantern light.',eyebrow:'A little room to grow',premium:false},
 {id:'midnight-observatory',name:'Midnight Observatory',description:'Deep indigo, silver constellations, and a violet moon.',eyebrow:'Space for your next idea',premium:true},
 {id:'amber-hearth',name:'Amber Hearth',description:'Cocoa velvet, burnished copper, and a soft fireside glow.',eyebrow:'Settle into your own rhythm',premium:true},
];
export const isThemeId=(value:unknown):value is ThemeId=>typeof value==='string'&&(themeIds as readonly string[]).includes(value);
