import { connect, StringCodec, JetStreamClient } from 'nats';


let nc: any;
export const sc = StringCodec();
let jsm: JetStreamClient | null = null;


export async function initNats() {
nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
jsm = nc.jetstream();
console.log('NATS connected');
return nc;
}


export function natsClient() {
if (!nc) throw new Error('NATS not initialized');
return nc;
}


export function jetstream() {
if (!jsm) throw new Error('JetStream not initialized');
return jsm;