// Luxon runtime is bundled locally; this narrow ambient declaration is used
// when the optional community type package is unavailable offline.
declare module 'luxon' {
 export const DateTime:any;
 export const IANAZone:{isValidZone(zone:string):boolean};
}
