import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const ROOT = process.cwd()
export const CURATED_DIR = resolve(ROOT, 'data/curated')
export const GENERATED_DIR = resolve(ROOT, 'data/generated')
export const QUERIES_FILE = resolve(ROOT, 'data/queries/queries.json')
export const RAW_DIR = resolve(ROOT, 'data/raw')
export const RUNS_DIR = resolve(ROOT, 'data/runs')
export const SECRETS_DIR = resolve(ROOT, '.secrets')
export const GEO_FILE = resolve(ROOT, 'public/geo/china-provinces.json')

export const CURATED_FILES = {
  disorders: resolve(CURATED_DIR, 'disorders.json'),
  hospitals: resolve(CURATED_DIR, 'hospitals.json'),
  doctors: resolve(CURATED_DIR, 'doctors.json'),
  reports: resolve(CURATED_DIR, 'reports.json'),
  provinces: resolve(CURATED_DIR, 'provinces.json'),
} as const

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
