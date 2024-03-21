#! /   usr/bin/env     node
import { commonUtility } from './utilityCommon'
import { pyUtility } from './utilityPY'
import { cfgUtility } from './utilityCFG'
import { shUtility } from './utilitySH'
import { htmlUtility } from './utilityHTML'

export const LanguageInstances = {
  javascript: commonUtility,
  typescript: commonUtility,
  vue: commonUtility,
  json: commonUtility,
  snippets: commonUtility,
  rust: commonUtility,
  jsonc: commonUtility,
  java: commonUtility,
  xml: commonUtility,
  yaml: commonUtility,
  proto3: commonUtility,
  aspnetcorerazor: commonUtility,
  powershell: commonUtility,
  csharp: commonUtility,
  dockerfile: commonUtility,
  go: commonUtility,
  sql: commonUtility,
  typescriptreact: commonUtility,
  prisma: commonUtility,
  html: htmlUtility,
  markdown: commonUtility,
  log: commonUtility,
  python: pyUtility,
  properties: cfgUtility,
  shellscript: shUtility,
}

export type Language = keyof typeof LanguageInstances
export type commLanguage1 = Exclude<Language, 'python' | 'properties' | 'shellscript'> | undefined

export type commLanguage2<O = typeof LanguageInstances> = keyof {
  [K in keyof O as O[K] extends typeof commonUtility ? K : never]: any
}
