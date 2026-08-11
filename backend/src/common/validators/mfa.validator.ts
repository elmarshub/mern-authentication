import {z} from 'zod'


export const verifyMFASchema = z.object({
    code: z.string().trim().min(1, "Code is required").max(6, "Code must be at most 6 characters"),
})

export const verifyMFAForLoginSchema = z.object({
    code: z.string().trim().min(1, "Code is required").max(6, "Code must be at most 6 characters"),
    email: z.string().trim().email("Invalid email address").min(1),
    userAgent: z.string().optional()
})