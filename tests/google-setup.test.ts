import {describe,it,expect,vi} from 'vitest';
import {parseDesktopClient,connectGoogleWithSetup} from '../electron/google-setup';

describe('Google sign-in setup',()=>{
 it('opens sign-in directly when client configuration already exists',async()=>{
  const pickClientFile=vi.fn(),saveClient=vi.fn(),connect=vi.fn();
  await connectGoogleWithSetup({configured:true,secureStorage:true,pickClientFile,saveClient,connect});
  expect(pickClientFile).not.toHaveBeenCalled();expect(connect).toHaveBeenCalledOnce();
 });
 it('imports the Desktop client file once and immediately opens sign-in',async()=>{
  const saved:string[]=[],connect=vi.fn();
  await connectGoogleWithSetup({configured:false,secureStorage:true,pickClientFile:async()=>JSON.stringify({installed:{client_id:'example.apps.googleusercontent.com',client_secret:'client-configuration'}}),saveClient:async c=>{saved.push(c.clientId,c.clientSecret)},connect});
  expect(saved).toEqual(['example.apps.googleusercontent.com','client-configuration']);expect(connect).toHaveBeenCalledOnce();
 });
 it('cancels without changing configuration or opening a browser',async()=>{
  const saveClient=vi.fn(),connect=vi.fn();
  await connectGoogleWithSetup({configured:false,secureStorage:true,pickClientFile:async()=>null,saveClient,connect});
  expect(saveClient).not.toHaveBeenCalled();expect(connect).not.toHaveBeenCalled();
 });
 it('refuses setup when secure storage is unavailable',async()=>{
  const pickClientFile=vi.fn(),connect=vi.fn();
  await expect(connectGoogleWithSetup({configured:false,secureStorage:false,pickClientFile,saveClient:vi.fn(),connect})).rejects.toThrow('secure');expect(pickClientFile).not.toHaveBeenCalled();
 });
 it('rejects web clients, token exports, invalid JSON and malformed IDs',()=>{
  for(const raw of ['{}','invalid',JSON.stringify({web:{client_id:'example.apps.googleusercontent.com'}}),JSON.stringify({access_token:'secret'}),JSON.stringify({installed:{client_id:'invalid'}})])expect(()=>parseDesktopClient(raw)).toThrow('Desktop');
 });
 it('never trusts authorization URLs supplied in the client file',()=>{
  expect(parseDesktopClient(JSON.stringify({installed:{client_id:'example.apps.googleusercontent.com',auth_uri:'https://evil.invalid',token_uri:'https://evil.invalid'}}))).toEqual({clientId:'example.apps.googleusercontent.com',clientSecret:''});
 });
});
