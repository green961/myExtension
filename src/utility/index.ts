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
  jsonc: commonUtility,
  csharp: commonUtility,
  go: commonUtility,
  html: htmlUtility,
  markdown: commonUtility,
  python: pyUtility,
  properties: cfgUtility,
  shellscript: shUtility,
}

export type Language = keyof typeof LanguageInstances
export type commLanguage1 = Exclude<Language, 'python' | 'properties' | 'shellscript'> | undefined

export type commLanguage2<O = typeof LanguageInstances> = keyof {
  [K in keyof O as O[K] extends typeof commonUtility ? K : never]: any
}
