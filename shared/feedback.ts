import {z} from 'zod';
export const feedbackSchema=z.object({
 message:z.string().trim().min(5,'Please write at least five characters.').max(5000),
 replyTo:z.union([z.literal(''),z.email().max(254)]).default('')
}).strict();
export type FeedbackInput=z.infer<typeof feedbackSchema>;
export const appDisplayName='My Tasks — Enchanted Forest';
