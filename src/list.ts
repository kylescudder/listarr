import { z } from 'zod'
export const idsSchema = z
  .array(z.number().int().positive().max(2147483647))
  .min(1)
  .max(100)
  .transform((ids) => [...new Set(ids)].sort((a, b) => a - b))
export const listSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ids: idsSchema
})
export type Movie = {
  id: number
  title: string
  release_date?: string
  overview?: string
  poster_path?: string | null
  vote_average?: number
}
export function encodeList(ids: number[]) {
  return idsSchema.parse(ids).join(',')
}
export function decodeList(value: string) {
  if (!/^\d+(,\d+)*$/.test(value)) throw new Error('Invalid list')
  return idsSchema.parse(value.split(',').map(Number))
}
export function listUrl(origin: string, ids: number[]) {
  return `${origin}/api/feed?ids=${encodeList(ids)}`
}
