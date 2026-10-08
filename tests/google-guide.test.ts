import {describe,it,expect} from 'vitest';
import {googleSetupLinks} from '../shared/google-guide';
import {commandSchema} from '../electron/commands';
describe('Google setup guide links',()=>{
 it('allows only named setup destinations and refuses arbitrary URLs',()=>{
  for(const destination of Object.keys(googleSetupLinks))expect(commandSchema.parse({type:'google.openSetup',destination})).toEqual({type:'google.openSetup',destination});
  expect(()=>commandSchema.parse({type:'google.openSetup',destination:'https://evil.invalid'})).toThrow();
  expect(()=>commandSchema.parse({type:'google.openSetup',destination:'clients',url:'file:///C:/Windows'})).toThrow();
 });
 it('uses official Google HTTPS pages for every guide action',()=>{
  expect(Object.keys(googleSetupLinks)).toHaveLength(6);
  for(const url of Object.values(googleSetupLinks)){const parsed=new URL(url);expect(parsed.protocol).toBe('https:');expect(['console.cloud.google.com','developers.google.com']).toContain(parsed.hostname);}
 });
});
