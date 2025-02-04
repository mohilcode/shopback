import { GoogleGenerativeAI } from '@google/generative-ai'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import {
  LANGUAGE_NAMES,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
  JMA_LANGUAGE_MAPPING,
  EARTHQUAKE_CACHE_TTL,
} from './constants'
import {
  LanguageCode,
  JanCodeSchema,
  type Product,
  IngredientsResponseSchema,
  type IngredientsResponse,
  geminiIngredientsSchema,
  type ProcessedEarthquake,
  type ProcessedJustEarthquake,
} from './types'
import { translateEarthquakeData, fetchJMAData, getTranslations } from './utils/jma'
import { fetchRakutenItem, fetchYahooItem } from './utils/product'
import { getGeminiResponse } from './utils/gemini'
import { arrayBufferToBase64 } from './utils'

type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number]

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use(
  '*',
  cors({
    origin: 'https://shop.mohil.dev',
    allowMethods: ['GET', 'POST'],
    exposeHeaders: ['Content-Type'],
  })
)

app.get(
  '/barcode/:janCode/:lang',
  zValidator(
    'param',
    z.object({
      janCode: JanCodeSchema,
      lang: LanguageCode,
    })
  ),
  async c => {
    const { janCode, lang } = c.req.valid('param')
    const cacheKey = `${janCode}:${lang}`

    const cached = await c.env.PRODUCT_CACHE.get(cacheKey, 'json')
    if (cached) {
      return c.json(cached)
    }

    try {
      const [rakutenData, yahooData] = await Promise.allSettled([
        fetchRakutenItem(janCode, c.env.RAKUTEN_APP_ID),
        fetchYahooItem(janCode, c.env.YAHOO_APP_ID),
      ])

      const sources = [
        rakutenData.status === 'fulfilled' && rakutenData.value,
        yahooData.status === 'fulfilled' && yahooData.value,
      ].filter(Boolean) as Product[]

      if (!sources.length) {
        return c.json({ error: 'No product information found' }, 404)
      }

      const sourceIntro =
        sources.length > 1
          ? 'Analyze and combine these product descriptions'
          : 'Analyze this product description'

      const prompt = `
        ${sourceIntro} to create a concise summary. Focus on essential information:
        - Product name and type (Do not include quantity or packaging details in name)
        - Key features
        - Main ingredients/materials
        - Primary purpose and usage

        Ensure the description is:
        - Clear and concise
        - Easy to understand
        - Focused on practical information
        - Well-structured

        Remove any:
        - Packaging details
        - Dates and expiration info
        - Shipping/delivery info
        - Storage instructions
        - Pricing
        - Promotional text
        - Shop-specific details
        - Event/occasion suggestions

        Source${sources.length > 1 ? 's' : ''}:
        ${sources
          .map(
            (s, i) => `
          ${sources.length > 1 ? `Source ${i + 1}:` : ''}
          - Name: ${s.name}
          - Description: ${s.description}
        `
          )
          .join('\n')}
      `

      const result = await getGeminiResponse(prompt, c.env.GEMINI_API_KEY, lang)

      await c.env.PRODUCT_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 31536000 })
      return c.json(result)
    } catch (error) {
      console.error(error)
      return c.json({ error: 'Failed to process request' }, 500)
    }
  }
)

app.post(
  '/ingredients',
  zValidator(
    'form',
    z.object({
      file: z.instanceof(File),
      lang: LanguageCode,
    })
  ),
  async c => {
    const { file, lang } = c.req.valid('form')

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (!SUPPORTED_MIME_TYPES.includes(file.type as SupportedMimeType)) {
      return c.json(
        {
          error: `Unsupported file type. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
        },
        400
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        400
      )
    }

    try {
      const arrayBuffer = await file.arrayBuffer()

      const genAI = new GoogleGenerativeAI(c.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiIngredientsSchema,
        },
      })

      const imagePart = {
        inlineData: {
          data: arrayBufferToBase64(arrayBuffer),
          mimeType: file.type,
        },
      }

      const prompt = `
        Analyze this product image and extract all ingredients. For each ingredient:
        1. Identify its common name in ${LANGUAGE_NAMES[lang]}
        2. Determine if any ingredients are non-vegetarian, contain meat/fish, or make the product non-vegan
        3. Add a note about any uncertain identifications, ambiguous ingredient names, or potential cross-contamination warnings
        4. Dairy is considered vegetarian

        Important:
        - Be thorough in ingredient identification
        - Note any allergens clearly
        - Mention if any text is unclear or partially visible
        - Don't be overly cautious about origin of ingredients, like if amino acids are present, don't wonder if they're from animal sources or not unless mentioned explicitly
        - If ingredients list is not visible or readable, state this clearly in the note
        - output ingredients and note in ${LANGUAGE_NAMES[lang]} language

        Respond with valid JSON format matching the specified schema.
      `

      const result = await model.generateContent([prompt, imagePart])
      const textResult = result.response.text()

      let parsedResult: IngredientsResponse

      try {
        parsedResult = IngredientsResponseSchema.parse(JSON.parse(textResult))
      } catch (parseError) {
        console.error('Response parsing error:', parseError)
        return c.json(
          {
            error: 'Failed to parse ingredients information',
            details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          },
          422
        )
      }

      return c.json(parsedResult)
    } catch (error) {
      console.error('Ingredients analysis error:', error)

      return c.json(
        {
          error:
            'Failed to analyze ingredients. Please ensure the image contains legible ingredient information.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      )
    }
  }
)

app.get(
  '/earthquakes/:lang?',
  zValidator(
    'query',
    z.object({
      force: z.boolean().optional(),
    })
  ),
  zValidator(
    'param',
    z.object({
      lang: z.enum(Object.keys(JMA_LANGUAGE_MAPPING) as [string, ...string[]]).optional(),
    })
  ),
  async c => {
    const lang = (c.req.valid('param').lang || 'en') as keyof typeof JMA_LANGUAGE_MAPPING
    const dictLang = JMA_LANGUAGE_MAPPING[lang]
    const forceUpdate = c.req.valid('query').force

    try {
      const cachedData = (await c.env.JMA_DATA.get('earthquakes:latest', 'json')) as {
        detailed: ProcessedEarthquake[]
        basic: ProcessedJustEarthquake[]
      } | null

      if (!forceUpdate && cachedData) {
        const translations = await getTranslations(c.env.JMA_DATA)
        return c.json({
          data: {
            detailed: translateEarthquakeData(cachedData.detailed, dictLang, translations),
            basic: translateEarthquakeData(cachedData.basic, dictLang, translations),
          },
          last_updated: new Date().toISOString(),
        })
      }

      const earthquakeData = await fetchJMAData()
      await c.env.JMA_DATA.put('earthquakes:latest', JSON.stringify(earthquakeData), {
        expirationTtl: EARTHQUAKE_CACHE_TTL,
      })

      const translations = await getTranslations(c.env.JMA_DATA)
      return c.json({
        data: {
          detailed: translateEarthquakeData(earthquakeData.detailed, dictLang, translations),
          basic: translateEarthquakeData(earthquakeData.basic, dictLang, translations),
        },
        last_updated: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error processing earthquake data:', error)
      return c.json({ error: 'Failed to fetch earthquake data' }, 500)
    }
  }
)

app.get('/', c => c.text('Hello World!'))

export default {
  async fetch(request: Request, env: CloudflareBindings, _ctx: ExecutionContext) {
    return app.fetch(request, env)
  },

  async scheduled(
    _controller: ScheduledController,
    env: CloudflareBindings,
    _ctx: ExecutionContext
  ) {
    try {
      const earthquakeData = await fetchJMAData()
      await env.JMA_DATA.put('earthquakes:latest', JSON.stringify(earthquakeData), {
        expirationTtl: EARTHQUAKE_CACHE_TTL,
      })
    } catch (error) {
      console.error('Error updating earthquake data in cron job:', error)
      throw error
    }
  },
}
