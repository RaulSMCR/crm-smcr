//src/lib/resend.js:

import { Resend } from 'resend';

// Si no hay key (ej: en build), evitamos que explote
const apiKey = process.env.RESEND_API_KEY || 're_dummy_key';

export const resend = new Resend(apiKey);
