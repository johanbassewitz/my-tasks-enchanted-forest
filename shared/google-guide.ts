// Renderer sends a named destination; the main process chooses the fixed URL.
export const googleSetupDestinations=['project','api','branding','audience','clients','docs'] as const;
export type GoogleSetupDestination=typeof googleSetupDestinations[number];
export const googleSetupLinks:Record<GoogleSetupDestination,string>={
 project:'https://console.cloud.google.com/projectcreate',
 api:'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
 branding:'https://console.cloud.google.com/auth/branding',
 audience:'https://console.cloud.google.com/auth/audience',
 clients:'https://console.cloud.google.com/auth/clients',
 docs:'https://developers.google.com/workspace/calendar/api/quickstart/nodejs'
};
